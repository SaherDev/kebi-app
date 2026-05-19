'use client';

import { create } from 'zustand';
import type { EnrichedLocation } from '../lib/location';

/**
 * Session-only browser geolocation store.
 *
 * Holds the user's coordinates captured once per session via
 * `navigator.geolocation.getCurrentPosition`. The store is in-memory only —
 * no persistence layer, no localStorage, no cookies. It resets every
 * page reload, which is intentional: each new session re-prompts the
 * provider (the browser itself caches and suppresses the dialog based
 * on its own policy — we do not).
 *
 * `location` is `null` when:
 *   - the hook has not yet resolved,
 *   - the user denied the permission prompt,
 *   - `navigator.geolocation` is unavailable (e.g. SSR, non-https),
 *   - the underlying call threw or timed out.
 *
 * `resolved` flips to `true` after the first attempt completes,
 * regardless of outcome. HTTP callers read `location` directly and
 * should always tolerate `null`.
 *
 * The stored value is an {@link EnrichedLocation}: raw `lat`/`lng` plus a
 * best-effort `context` (city/neighborhood/district/country) resolved
 * client-side. The `context` is `null` when reverse geocoding could not
 * be performed.
 */
interface LocationStoreState {
  location: EnrichedLocation | null;
  resolved: boolean;
  setLocation: (location: EnrichedLocation | null) => void;
}

export const useLocationStore = create<LocationStoreState>((set) => ({
  location: null,
  resolved: false,
  setLocation: (location) => set({ location, resolved: true }),
}));

/**
 * Non-hook accessor for use outside React (HttpClient, Server Actions
 * invoked from client callers, etc.). Reads the current snapshot.
 */
export function getLocationSnapshot(): EnrichedLocation | null {
  return useLocationStore.getState().location;
}
