/**
 * Gateway route paths, appended to EXPO_PUBLIC_API_URL by the transport.
 * Paths live here (not inline at call sites) to keep them in one place.
 */
export const API_ROUTES = {
  health: '/health',
  /** Provisions the user on sign-in (first authenticated call) — creates the product user server-side. */
  login: '/auth/login',
  /** Saves a place: forwards a URL or place name to kebi for extraction (ADR-073). */
  extract: '/extract',
  /** The Library: browse the caller's saved places, keyset-paged (api-contract.md §GET /v1/user/library). */
  library: '/user/library',
  /** One saved place: PATCH user-state / DELETE the save (api-contract.md §/v1/user/places/{id}). */
  userPlace: (id: string) => `/user/places/${id}`,
} as const;
