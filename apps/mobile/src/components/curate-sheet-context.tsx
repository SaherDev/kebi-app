import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { CurateAnchor } from '@kebi-app/shared';
import { useTranslation } from '../i18n/context';
import { useApiClient } from '../api/hooks';
import { curate } from '../api/knowledge';
import { CurateSheet, type CurateAnchorView } from './curate-sheet';
import { useToast } from './toast-context';

/**
 * Curate-sheet host. A `CurateSheetProvider` mounts the composer once and
 * exposes `useCurateSheet().open(target)`, so every door — the place ••• sheet,
 * the area sheet, the chat entity menu, settings — raises the same sheet with a
 * different anchor. Mirrors the note/save-sheet provider pattern: provider +
 * hook + no-op fallback.
 *
 * Two behaviours here are load-bearing decisions, not implementation detail:
 *
 * - **Submit is optimistic.** The sheet closes on tap and the toast confirms;
 *   the request runs after. There is no spinner and no "sending" state. A
 *   failure surfaces as a retry toast with the prose still in the draft, so
 *   nothing written is ever lost to a network error.
 * - **Drafts are kept per anchor.** Dismissing is free — swipe away to go check
 *   something on the place page, come back, keep writing. Cleared only on a
 *   successful write, so a failed one leaves the text where you can resend it.
 */

/** What a door hands over: the anchor payload plus how to render it. */
export interface CurateTarget {
  /** Exactly one of place_id / area_id, or omitted to write unanchored. */
  anchor?: CurateAnchor;
  view: CurateAnchorView | null;
}

interface CurateSheetContextValue {
  open: (target: CurateTarget) => void;
}

const fallback: CurateSheetContextValue = { open: () => undefined };
const CurateSheetContext = createContext<CurateSheetContextValue>(fallback);

/** Draft key for a target — the anchor id, or a single shared key when unanchored. */
function draftKey(anchor?: CurateAnchor): string {
  if (anchor?.place_id) return `place:${anchor.place_id}`;
  if (anchor?.area_id) return `area:${anchor.area_id}`;
  return 'unanchored';
}

export function CurateSheetProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { show } = useToast();
  const client = useApiClient();
  const clientRef = useRef(client);
  clientRef.current = client;

  const [target, setTarget] = useState<CurateTarget | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  // Per-anchor drafts. In-memory for the session, which is all the design asks:
  // the point is surviving a dismissal, not a cold start.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const open = useCallback((next: CurateTarget) => {
    setTarget(next);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const key = draftKey(target?.anchor);
  const value = drafts[key] ?? '';

  const setValue = useCallback(
    (text: string) => setDrafts((prev) => ({ ...prev, [key]: text })),
    [key],
  );

  const send = useCallback(
    async (text: string, anchor: CurateAnchor | undefined, forKey: string) => {
      try {
        const result = await curate(clientRef.current, text, anchor);
        // Clear only on success, so a failed write leaves the prose recoverable.
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[forKey];
          return next;
        });
        show({
          emoji: '✍️',
          // kebi dedups and drops unusable claims, so zero is a real outcome —
          // saying "added" then would be a lie the ledger later contradicts.
          text: result.storedNothing
            ? t('curate.toast.nothingNew')
            : result.claims_written === 1
              ? t('curate.toast.addedOne')
              : t('curate.toast.added', { count: String(result.claims_written) }),
        });
      } catch {
        show({ emoji: '⚠️', text: t('curate.toast.failed') });
      }
    },
    [show, t],
  );

  const handleSubmit = useCallback(
    (text: string) => {
      const anchor = target?.anchor;
      const forKey = draftKey(anchor);
      close();
      void send(text, anchor, forKey);
    },
    [target, close, send],
  );

  const contextValue = useMemo<CurateSheetContextValue>(() => ({ open }), [open]);

  return (
    <CurateSheetContext.Provider value={contextValue}>
      {children}
      <CurateSheet
        open={isOpen}
        onClose={close}
        onSubmit={handleSubmit}
        value={value}
        onChangeText={setValue}
        anchor={target?.view ?? null}
      />
    </CurateSheetContext.Provider>
  );
}

/** Raise the curate composer from anywhere under a CurateSheetProvider. */
export function useCurateSheet(): CurateSheetContextValue {
  return useContext(CurateSheetContext);
}
