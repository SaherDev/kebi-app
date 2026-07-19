/**
 * Gateway route paths, appended to EXPO_PUBLIC_API_URL by the transport.
 * Paths live here (not inline at call sites) to keep them in one place.
 */
export const API_ROUTES = {
  health: '/health',
  /** Provisions the user on sign-in (first authenticated call) — creates the product user server-side. */
  login: '/auth/login',
  /** Conversational turn — always-streaming SSE (api-contract.md §POST /v1/chat/stream, ADR-036). */
  chat: '/chat',
  /** Saves a place: forwards a URL or place name to kebi for extraction (ADR-073). */
  extract: '/extract',
  /** Home opening surface: context-aware greeting + suggestion chips (api-contract.md §GET /v1/home). */
  home: '/home',
  /** The Library: browse the caller's saved places, keyset-paged (api-contract.md §GET /v1/user/library). */
  library: '/user/library',
  /** "what you wanted" recall: the caller's recent intent-bearing turns (api-contract.md §GET /v1/user/intents). */
  userIntents: '/user/intents',
  /** Save a recommended place — the consult card's "save it" (api-contract.md §POST /v1/user/places). */
  userPlaces: '/user/places',
  /** One saved place: PATCH user-state / DELETE the save (api-contract.md §/v1/user/places/{id}). */
  userPlace: (id: string) => `/user/places/${id}`,
  /** The caller's display profile: GET name/email/plan, PATCH the display name (gateway-local). */
  userProfile: '/user/profile',
  /** Switch the caller's plan tier — PATCH plan, re-stamps the token (gateway-local). */
  userPlan: '/user/plan',
  /** Wipe the caller's AI-owned data — "nuke my data" (api-contract.md §DELETE /v1/user/data). */
  userData: '/user/data',
  /** Recommendation accept/reject signal (api-contract.md §POST /v1/signal). */
  signal: '/signal',

  /** In-app feedback report — gateway-only, forwarded to Notion (ADR-051). */
  feedback: '/feedback',
} as const;
