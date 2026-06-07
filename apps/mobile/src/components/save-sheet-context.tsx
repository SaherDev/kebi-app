import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { SaveSheet } from './save-sheet';

/**
 * Save-sheet host. A `SaveSheetProvider` mounts the sheet once and exposes
 * `useSaveSheet().open()` so any screen's save trigger (the `share-in` icon on
 * home and library) raises the same sheet. Mirrors the toast/context-menu
 * provider pattern: provider + hook + no-op fallback.
 *
 * Persistence is a later task (ADR-041 — no fake save): `onSubmit` is a
 * `TODO(gateway)` stub that just closes. The sheet's "saving" state is built and
 * prop-driven, ready for the wiring pass to flip it.
 */
interface SaveSheetContextValue {
  open: () => void;
}

// No-op fallback so useSaveSheet() outside a provider is harmless (matches useToast).
const fallback: SaveSheetContextValue = { open: () => undefined };
const SaveSheetContext = createContext<SaveSheetContextValue>(fallback);

export function SaveSheetProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // TODO(gateway): forward `text` to POST /v1/extract and surface a save toast.
  // For now the sheet is UI-only — submitting just closes it.
  const handleSubmit = useCallback((_text: string) => {
    setIsOpen(false);
  }, []);

  const value = useMemo<SaveSheetContextValue>(() => ({ open }), [open]);

  return (
    <SaveSheetContext.Provider value={value}>
      {children}
      <SaveSheet open={isOpen} onClose={close} onSubmit={handleSubmit} />
    </SaveSheetContext.Provider>
  );
}

/** Open the save sheet from anywhere under a SaveSheetProvider. */
export function useSaveSheet(): SaveSheetContextValue {
  return useContext(SaveSheetContext);
}
