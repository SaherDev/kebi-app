'use client';

import { create } from 'zustand';
import type { Location } from '@kebi-app/shared';

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
 */
interface LocationStoreState {
  location: Location | null;
  resolved: boolean;
  setLocation: (location: Location | null) => void;
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
export function getLocationSnapshot(): Location | null {
  return useLocationStore.getState().location;
}
