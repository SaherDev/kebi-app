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
} as const;
