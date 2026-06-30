import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useApiClient } from '../api/hooks';
import { extractPlace, EXTRACT_TIMEOUT_MS } from '../api/extract';
import { useTranslation } from '../i18n/context';
import { SaveSheet } from './save-sheet';
import { useToast } from './toast-context';
import { useUpgradeToast } from './use-upgrade-toast';
import { useSavedPlaces } from './saved-places-context';

/**
 * Save-sheet host. A `SaveSheetProvider` mounts the sheet once and exposes
 * `useSaveSheet().open()` so any screen's save trigger (the `share-in` icon on
 * home and library) raises the same sheet. Mirrors the toast/context-menu
 * provider pattern: provider + hook + no-op fallback.
 *
 * Submitting forwards the text to `POST /v1/extract` (api/extract). Extraction
 * is synchronous and can take ~30–60 s for a cold video URL, so the sheet shows
 * its `saving` state for the whole call. On success the extracted place(s) land
 * in the saved-places store and a confirmation toast shows; on failure an error
 * toast shows and the sheet stays open with the draft intact so the user can
 * fix and retry (domain `failed` rides a 200; transport/validation errors throw).
 */
interface SaveSheetContextValue {
  open: () => void;
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
  const [status, setStatus] = useState<'idle' | 'saving'>('idle');

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const handleSubmit = useCallback(
    async (text: string) => {
      // CTA is disabled while saving, but guard re-entry regardless.
      if (status === 'saving') return;
      setStatus('saving');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), EXTRACT_TIMEOUT_MS);
      try {
        const res = await extractPlace(client, text, controller.signal);
        if (res.status === 'completed' && res.results.length > 0) {
          const places = res.results.map((r) => r.place);
          add(places);
          toast.show({
            tone: 'success',
            icon: 'check',
            text:
              places.length === 1
                ? t('toast.saved', { name: places[0].place_name })
                : t('toast.savedMany', { count: places.length }),
          });
          setStatus('idle');
          close();
          return;
        }
        // Domain failure (failed / pending / empty) — keep the sheet open to retry.
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
          });
        }
        setStatus('idle');
      } catch {
        // Transport error, schema drift, or timeout abort.
        toast.show({ tone: 'danger', icon: 'alert', text: t('toast.saveFailed') });
        setStatus('idle');
      } finally {
        clearTimeout(timeout);
      }
    },
    [status, client, add, toast, showUpgrade, t, close],
  );

  const value = useMemo<SaveSheetContextValue>(() => ({ open }), [open]);

  return (
    <SaveSheetContext.Provider value={value}>
      {children}
      <SaveSheet open={isOpen} onClose={close} onSubmit={handleSubmit} status={status} />
    </SaveSheetContext.Provider>
  );
}

/** Open the save sheet from anywhere under a SaveSheetProvider. */
export function useSaveSheet(): SaveSheetContextValue {
  return useContext(SaveSheetContext);
}
