import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { SavedPlaceView } from '@kebi-app/shared';

/**
 * Holds the saved place the user is currently viewing on the place detail page.
 * Data path A (no GET-by-id endpoint): a list surface (the Library card, a chat
 * card) calls `set(view)` with a `SavedPlaceView` it already has, then navigates
 * to `/place`, which reads it back via `usePlaceDetail()`. The view is a
 * validated class instance (ADR-046), so it passes by reference here rather than
 * being serialised through route params.
 *
 * In-memory only and single-slot — like the other session providers (saved
 * places, chat transcript). Holds real loaded data, never a fixture (ADR-041).
 */

export interface PlaceDetailValue {
  /** The place being viewed, or null when none has been selected. */
  view: SavedPlaceView | null;
  /** Select a place to view — call just before navigating to `/place`. */
  set: (view: SavedPlaceView) => void;
  /** Drop the current selection. */
  clear: () => void;
}

const fallback: PlaceDetailValue = {
  view: null,
  set: () => undefined,
  clear: () => undefined,
};

const PlaceDetailContext = createContext<PlaceDetailValue>(fallback);

export function PlaceDetailProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<SavedPlaceView | null>(null);

  const set = useCallback((next: SavedPlaceView) => setView(next), []);
  const clear = useCallback(() => setView(null), []);

  const value = useMemo<PlaceDetailValue>(() => ({ view, set, clear }), [view, set, clear]);

  return <PlaceDetailContext.Provider value={value}>{children}</PlaceDetailContext.Provider>;
}

/** Read / set the place shown on the detail page, from anywhere under the provider. */
export function usePlaceDetail(): PlaceDetailValue {
  return useContext(PlaceDetailContext);
}
