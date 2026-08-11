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
  /** One place, saved by the caller or not — the place screen (api-contract.md §GET /v1/places/{id}). */
  place: (id: string) => `/places/${encodeURIComponent(id)}`,
  /**
   * One area — the area screen behind every area link (api-contract.md
   * §GET /v1/areas/{id}, kebi ADR-153). `id` is the opaque token off the link's
   * `uri`, never the raw geo key on the entity's `key`.
   */
  area: (id: string) => `/areas/${encodeURIComponent(id)}`,
  /** Save a place to the caller's library — the place screen's "save" (api-contract.md §POST /v1/user/places). */
  userPlaces: '/user/places',
  /** One saved place: PATCH user-state / DELETE the save (api-contract.md §/v1/user/places/{id}). */
  userPlace: (id: string) => `/user/places/${id}`,
  /** The caller's display profile: GET name/email/plan, PATCH the display name (gateway-local). */
  userProfile: '/user/profile',
  /**
   * The caller's own about-me + movement profile (gateway-local). GET reads
   * them back for the screens that edit them — they ride the token as a sealed
   * claim the client cannot decode (ADR-044).
   */
  userSettings: '/user/settings',
  /** Write the about-me kebi reads as a cold-start prior (kebi ADR-154). Whole-block. */
  userAboutMe: '/user/about-me',
  /** Write the movement modes the user chose — the only path that sets source: "user" (kebi ADR-155). */
  userMovement: '/user/movement',
  /** Switch the caller's plan tier — PATCH plan, re-stamps the token (gateway-local). */
  userPlan: '/user/plan',
  /** Wipe the caller's AI-owned data — "nuke my data" (api-contract.md §DELETE /v1/user/data). */
  userData: '/user/data',
  // The accept/reject signal route retired with the recommendation card
  // (ADR-151) — kebi deleted the endpoint, so there is nothing to call.

  /** In-app feedback report — gateway-only, forwarded to Notion (ADR-051). */
  feedback: '/feedback',

  /**
   * Insider curation (ADR-121, anchors kebi ADR-160). Every route here is gated
   * on the curator role — a non-insider gets a 403, which is why the client
   * gates the affordances behind `useCan('curate')` rather than calling blind.
   */
  knowledgeCurate: '/knowledge/curate',
  /** The caller's own claims — what backs "what you've added". */
  knowledgeClaims: '/knowledge/claims',
  /** Retract one of the caller's own claims by id. */
  knowledgeClaim: (id: string) => `/knowledge/claims/${encodeURIComponent(id)}`,
  /** Typeahead behind the anchor chip — places and areas in one list. */
  knowledgeEntities: '/knowledge/entities',
} as const;
