import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { PlaceView } from '@kebi-app/shared';

/**
 * Seeds the place detail page with a view the caller already holds. A list
 * surface (the Library card) calls `set(view)` just before navigating to
 * `/place?id=…`, so the screen paints with no spinner; the screen still fetches
 * `GET /v1/places/{id}` behind the seed to refresh claims and user-state, and a
 * surface with nothing to hand over (a chat venue tap) simply navigates and
 * lets that fetch be the only path. The view is a validated class instance
 * (ADR-046), so it passes by reference here rather than through route params.
 *
 * In-memory only and single-slot — like the other session providers (saved
 * places, chat transcript). Holds real loaded data, never a fixture (ADR-041).
 */

export interface PlaceDetailValue {
  /** The seeded place, or null when the screen has to fetch it itself. */
  view: PlaceView | null;
  /** Seed a place — call just before navigating to `/place?id=…`. */
  set: (view: PlaceView) => void;
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
  const [view, setView] = useState<PlaceView | null>(null);

  const set = useCallback((next: PlaceView) => setView(next), []);
  const clear = useCallback(() => setView(null), []);

  const value = useMemo<PlaceDetailValue>(() => ({ view, set, clear }), [view, set, clear]);

  return <PlaceDetailContext.Provider value={value}>{children}</PlaceDetailContext.Provider>;
}

/** Read / seed the place shown on the detail page, from anywhere under the provider. */
export function usePlaceDetail(): PlaceDetailValue {
  return useContext(PlaceDetailContext);
}
