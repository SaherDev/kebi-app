import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PlaceCore } from '@kebi-app/shared';

/**
 * Saved-places store. A `SavedPlacesProvider` holds the places the user has
 * saved this session; `useSavedPlaces()` exposes the list and an `add()` the
 * save flow calls once an extraction completes. The library reads `items` from
 * here. Mirrors the toast/save-sheet provider pattern (provider + hook + no-op
 * fallback) — the repo has no state library.
 *
 * In-memory only: there is no GET read endpoint yet, so the list resets on
 * reload (durable read is a later task). This holds real user-created data, not
 * fixtures (ADR-041).
 */
export interface SavedPlaceItem {
  /** Stable React key — `PlaceCore.id` is nullable, so a place can't supply one. */
  key: string;
  place: PlaceCore;
}

interface SavedPlacesContextValue {
  items: SavedPlaceItem[];
  /** Prepend newly-saved places (newest first), skipping ones already saved. */
  add: (places: PlaceCore[]) => void;
  /** Drop a place from the set (save-undo) — matched by the same identity as add. */
  remove: (place: PlaceCore) => void;
  /** Whether this place is already in the set — the consult card's saved-state. */
  isSaved: (place: PlaceCore) => boolean;
}

/**
 * Identity for dedup/membership: the external `provider_id` (e.g. `"google:…"`)
 * first — it's the stable real-world identity a place keeps across catalog state
 * (a kebi-discovered place carries it before it has a catalog `id`). Falls back
 * to the catalog `id`, then a normalised name when a place carries neither.
 */
function identityKey(place: PlaceCore): string {
  return place.provider_id ?? place.id ?? `name:${place.place_name.trim().toLowerCase()}`;
}

// No-op fallback so useSavedPlaces() outside a provider is harmless (matches useToast).
const fallback: SavedPlacesContextValue = {
  items: [],
  add: () => undefined,
  remove: () => undefined,
  isSaved: () => false,
};
const SavedPlacesContext = createContext<SavedPlacesContextValue>(fallback);

export function SavedPlacesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SavedPlaceItem[]>([]);
  // Monotonic client key counter (mirrors toast-context's idRef).
  const keyRef = useRef(0);

  const add = useCallback((places: PlaceCore[]) => {
    if (places.length === 0) return;
    setItems((prev) => {
      // Skip places already saved, and dedup within this batch (a maps list can
      // repeat) — keep the existing row rather than stacking a duplicate.
      const seen = new Set(prev.map((item) => identityKey(item.place)));
      const fresh: SavedPlaceItem[] = [];
      for (const place of places) {
        const key = identityKey(place);
        if (seen.has(key)) continue;
        seen.add(key);
        fresh.push({ key: `place-${(keyRef.current += 1)}`, place });
      }
      return fresh.length > 0 ? [...fresh, ...prev] : prev;
    });
  }, []);

  const remove = useCallback((place: PlaceCore) => {
    const key = identityKey(place);
    setItems((prev) => {
      const next = prev.filter((item) => identityKey(item.place) !== key);
      return next.length === prev.length ? prev : next;
    });
  }, []);

  // Membership set, recomputed only when the list changes — keeps isSaved() O(1).
  const savedKeys = useMemo(() => new Set(items.map((item) => identityKey(item.place))), [items]);
  const isSaved = useCallback(
    (place: PlaceCore) => savedKeys.has(identityKey(place)),
    [savedKeys],
  );

  const value = useMemo<SavedPlacesContextValue>(
    () => ({ items, add, remove, isSaved }),
    [items, add, remove, isSaved],
  );

  return <SavedPlacesContext.Provider value={value}>{children}</SavedPlacesContext.Provider>;
}

/** Read the saved places / add to them from anywhere under a SavedPlacesProvider. */
export function useSavedPlaces(): SavedPlacesContextValue {
  return useContext(SavedPlacesContext);
}
