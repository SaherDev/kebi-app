import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { SavedPlaceView } from '@kebi-app/shared';
import { useTranslation } from '../i18n/context';
import { NoteSheet } from './note-sheet';
import { usePlaceActions } from './place-actions-context';

/**
 * Note-sheet host. A `NoteSheetProvider` mounts the sheet once and exposes
 * `useNoteSheet().open(view)` so any surface (the place page, the library/place
 * action menu) raises the same editor for a saved place. Mirrors the save-sheet
 * provider pattern: provider + hook + no-op fallback.
 *
 * Saving routes through the global {@link usePlaceActions} `update` ({ note }),
 * so the change is optimistic and reflected everywhere the place appears; an
 * empty note clears it (`note: null`). The editor pre-fills from the place's
 * effective (override-aware) note via `resolve`.
 */
interface NoteSheetContextValue {
  open: (view: SavedPlaceView) => void;
}

const fallback: NoteSheetContextValue = { open: () => undefined };
const NoteSheetContext = createContext<NoteSheetContextValue>(fallback);

export function NoteSheetProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { update, resolve } = usePlaceActions();

  const [view, setView] = useState<SavedPlaceView | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback((next: SavedPlaceView) => {
    setView(next);
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);

  const handleSubmit = useCallback(
    (text: string) => {
      if (!view) return;
      void update(view, { note: text || null }, { emoji: '📝', text: t('note.toast.saved') });
      close();
    },
    [view, update, t, close],
  );

  const value = useMemo<NoteSheetContextValue>(() => ({ open }), [open]);
  const initialNote = view ? resolve(view).userData.note : null;

  return (
    <NoteSheetContext.Provider value={value}>
      {children}
      <NoteSheet open={isOpen && !!view} initialNote={initialNote} onClose={close} onSubmit={handleSubmit} />
    </NoteSheetContext.Provider>
  );
}

/** Open the note editor for a saved place from anywhere under a NoteSheetProvider. */
export function useNoteSheet(): NoteSheetContextValue {
  return useContext(NoteSheetContext);
}
