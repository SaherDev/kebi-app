import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApiClient } from '../api/hooks';
import { extractPlace, EXTRACT_GRACE_MS, EXTRACT_TIMEOUT_MS } from '../api/extract';
import { useTranslation } from '../i18n/context';
import { SaveSheet } from './save-sheet';
import { useToast } from './toast-context';
import { useUpgradeToast } from './use-upgrade-toast';
import { useSavedPlaces } from './saved-places-context';
import { recordSaveAttempt } from '../lib/save-history';
import { detectSource, isLinkSource } from '../lib/detect-source';
import { recordLocalSave, recordShareOutcome, toSharePlace } from '../lib/share-storage';

/**
 * Save-sheet host. A `SaveSheetProvider` mounts the sheet once and exposes
 * `useSaveSheet().open()` so any screen's save trigger (the `share-in` icon on
 * home and library) raises the same sheet. Mirrors the toast/context-menu
 * provider pattern: provider + hook + no-op fallback.
 *
 * Submitting forwards the text to `POST /v1/extract` (api/extract). Extraction
 * is synchronous and can take ~30–60 s for a cold video URL, so the sheet blocks
 * in its `saving` state only for EXTRACT_GRACE_MS; past that it flips to
 * `backgrounded` (kebi-save-sheet-background-mockup.html) — dismissal unlocks
 * while the request keeps running behind the sheet. Wherever the user is when
 * it lands, the result surfaces as a toast; a failure toast after the sheet was
 * dismissed carries a "try again" action that reopens it prefilled. Saves are
 * concurrent: closing a backgrounded save frees the sheet for another while the
 * first keeps running (each resolves to its own toast).
 *
 * The in-flight promise lives here, not in the sheet, so it survives the sheet
 * unmounting. `attachedSubmit` tracks which submit (if any) the visible sheet is
 * waiting on: a resolving submit only touches sheet state while still attached;
 * once the user dismisses (or a newer submit takes over) it is toast-only.
 * Backgrounding is best-effort by design: if the app is quit mid-save the fetch
 * dies with it, but the server finishes and the place appears on next launch.
 *
 * Every submit also writes a row into "recent activity" (lib/share-storage), the
 * same list the share extension feeds. A save made here and a link shared from
 * TikTok are the same event, so they belong on one surface — and this is the
 * path a link shared *into* the app takes too (ShareIntentReceiver only
 * prefills this sheet). The toast is unchanged and still the primary receipt;
 * the row is what survives it, which matters most on a failure the user has
 * already walked away from.
 */
interface SaveSheetContextValue {
  /** Raise the save sheet. `prefill` seeds the draft (iOS share flow); omit for an empty draft. */
  open: (prefill?: string) => void;
}

// No-op fallback so useSaveSheet() outside a provider is harmless (matches useToast).
const fallback: SaveSheetContextValue = { open: () => undefined };
const SaveSheetContext = createContext<SaveSheetContextValue>(fallback);

export function SaveSheetProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const client = useApiClient();
  const toast = useToast();
  const showUpgrade = useUpgradeToast();
  const { add } = useSavedPlaces();

  const [isOpen, setIsOpen] = useState(false);
  const [prefill, setPrefill] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'backgrounded'>('idle');

  // Monotonic submit ids; the sheet is "attached" to at most one in-flight
  // submit. Dismissing the sheet detaches it — the submit keeps running.
  const submitSeq = useRef(0);
  const attachedSubmit = useRef<number | null>(null);

  const open = useCallback((prefillText?: string) => {
    // Guard the draft: only a real string seeds it. A caller that wires this to
    // an onPress (`onPress={open}`) would otherwise pass the press event as the
    // prefill, and the non-string draft crashes detectSource (value.trim).
    setPrefill(typeof prefillText === 'string' ? prefillText : '');
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    // Closing a backgrounded sheet detaches its submit: the request keeps
    // running and resolves to a toast; the sheet is free for the next save.
    attachedSubmit.current = null;
    setStatus('idle');
    setIsOpen(false);
  }, []);

  const handleSubmit = useCallback(
    async (text: string) => {
      // CTA is disabled unless idle, but guard re-entry regardless.
      if (status !== 'idle') return;
      const id = ++submitSeq.current;
      attachedSubmit.current = id;
      setStatus('saving');

      // A pasted link is identified by its url, exactly like a shared one; a
      // typed place has no url to show, so the words the user wrote become the
      // row's name (see `title` on PendingShare).
      const activityId = recordLocalSave(text, isLinkSource(detectSource(text)) ? undefined : text);
      const land = (outcome: Parameters<typeof recordShareOutcome>[1]) => {
        if (activityId) recordShareOutcome(activityId, outcome);
      };

      // Still attached ⇒ this submit owns the visible sheet; may touch its state.
      const attached = () => attachedSubmit.current === id;
      // After the sheet is gone, failure toasts carry "try again" to bring it back.
      const retryAction = () =>
        attached() ? undefined : { label: t('toast.tryAgain'), onPress: () => open(text) };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), EXTRACT_TIMEOUT_MS);
      // Grace window elapsed with no result: relax the sheet to `backgrounded`.
      const grace = setTimeout(() => {
        if (attached()) setStatus('backgrounded');
      }, EXTRACT_GRACE_MS);

      try {
        const res = await extractPlace(client, text, controller.signal);
        if (res.status === 'completed' && res.results.length > 0) {
          const places = res.results.map((r) => r.place);
          // Feed the help page's "a save went wrong" report (lib/save-history).
          recordSaveAttempt(text, `saved: ${places.map((p) => p.place_name).join(', ')}`);
          land({ status: 'completed', places: places.map(toSharePlace) });
          add(places);
          toast.show({
            tone: 'success',
            icon: 'check',
            text:
              places.length === 1
                ? t('toast.saved', { name: places[0].place_name })
                : t('toast.savedMany', { count: places.length }),
          });
          if (attached()) close();
          return;
        }
        // Domain failure (failed / pending / empty) — sheet still up: stays open
        // with the draft to retry; already dismissed: the toast carries the retry.
        recordSaveAttempt(text, `failed: ${res.failure_reason ?? res.status}`);
        land({ status: 'failed', places: [], failure_reason: res.failure_reason ?? res.status });
        if (res.failure_reason === 'save_limit_reached') {
          // Library is full on the free tier (ADR-112) — point to plans.
          showUpgrade(t('plans.limitReached.save'));
        } else {
          toast.show({
            tone: 'danger',
            icon: 'alert',
            text:
              res.failure_reason === 'unsupported_url'
                ? t('toast.unsupportedUrl')
                : t('toast.saveFailed'),
            action: retryAction(),
          });
        }
        if (attached()) {
          attachedSubmit.current = null;
          setStatus('idle');
        }
      } catch {
        // Transport error, schema drift, or timeout abort.
        recordSaveAttempt(text, 'failed: network or timeout');
        land({ status: 'failed', places: [] });
        toast.show({
          tone: 'danger',
          icon: 'alert',
          text: t('toast.saveFailed'),
          action: retryAction(),
        });
        if (attached()) {
          attachedSubmit.current = null;
          setStatus('idle');
        }
      } finally {
        clearTimeout(timeout);
        clearTimeout(grace);
      }
    },
    [status, client, add, toast, showUpgrade, t, open, close],
  );

  const value = useMemo<SaveSheetContextValue>(() => ({ open }), [open]);

  return (
    <SaveSheetContext.Provider value={value}>
      {children}
      <SaveSheet
        open={isOpen}
        onClose={close}
        onSubmit={handleSubmit}
        status={status}
        initialValue={prefill}
      />
    </SaveSheetContext.Provider>
  );
}

/** Open the save sheet from anywhere under a SaveSheetProvider. */
export function useSaveSheet(): SaveSheetContextValue {
  return useContext(SaveSheetContext);
}
