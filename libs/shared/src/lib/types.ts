import type { Location } from "../schemas/location.js";
import type { PlaceSource } from "./category-emoji.js";
import type {
  LiteralUnion,
  PlaceCategory,
  PlaceTag,
} from "./place-taxonomy.js";

/**
 * Chat request body the gateway sends to kebi (POST /v1/chat,
 * /v1/chat/stream).
 *
 * Identity is NOT in the body — the gateway forwards the verified Clerk
 * subject as the `X-Gateway-User-Id` header.
 *
 * `location` is the user's actual position. The frontend attaches it from
 * a session-only store; `null` when geolocation was denied/unavailable.
 *
 * `movement_profile` is a user mobility setting carried as a Clerk
 * `publicMetadata` token claim (like `plan`). The gateway reads it from the
 * verified token and injects it here — the client never sends it. `null`
 * when the user has no profile set; kebi then applies a neutral fallback.
 */
export interface ChatRequestDto {
  message: string;
  location: Location | null;
  movement_profile: MovementProfile | null;
}

/**
 * A user-visible step the agent emitted this turn. Mirrors the non-stream
 * `api-contract.md` shape (POST /v1/chat → `data.reasoning_steps`), where every
 * step is already complete: `summary` is always set and the SSE-only lifecycle
 * fields (`id`, `status`) are absent. The streaming variant — with `id`,
 * `status`, and a nullable `summary` on the `active` frame — is
 * {@link SseReasoningStep} in `types/sse`.
 *
 * Two human-readable tiers (the trace renders both): `title` is the short
 * third-person action (the bold line — "searched nearby") and `summary` is the
 * result detail (the muted line). `step` is a machine identifier, never shown.
 * Tool identity is NOT here — it travels on {@link ToolResult.tool} (ADR-075
 * removed the `"tool"` source).
 */
export interface ReasoningStep {
  step: string;
  title: string;
  summary: string;
  source?: "agent" | "fallback";
  visibility?: "user" | "debug";
  duration_ms?: number;
  timestamp?: string;
}

// ── PlaceCore — canonical place shape on the kebi contract ───────────────────
// Returned inside chat `tool_results` and by POST /v1/extract. Static catalog
// fields only (no live rating/hours). `categories` and `tags` use the enum
// vocabularies in ./place-taxonomy, which mirror kebi's PlaceCategory / TagType
// and tag-value enums.

export interface PlaceNameAlias {
  value: string;
  source: string;
}

export interface PlaceCoreLocation {
  lat: number | null;
  lng: number | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  country: string | null;
}

export interface PlaceCore {
  id: string | null;
  provider_id: string | null;
  place_name: string;
  place_name_aliases: PlaceNameAlias[];
  categories: PlaceCategory[];
  tags: PlaceTag[];
  location: PlaceCoreLocation | null;
  created_at: string | null;
  refreshed_at: string | null;
}

// ── Chat response (POST /v1/chat) ────────────────────────────────────────────
// The agent runs a LangGraph turn with the consult-family tools. Each tool
// returns a ConsultResult surfaced in `data.tool_results`. The top-level
// `type` is only ever "agent" or "error" — all downstream failures are caught
// and returned as type="error" with HTTP 200 (see api-contract.md).

export type ConsultTool = "find_saved" | "suggest_places" | "discover_places";

export type ConsultCandidateSource = "saved" | "suggested" | "discovered";

/** Why a tool produced no candidates (e.g. "no_location", "no_match"). */
export type ConsultEmptyReason = LiteralUnion<"no_location" | "no_match">;

export interface ConsultCandidate {
  place: PlaceCore;
  source: ConsultCandidateSource;
  /** Namer's rationale, present for suggested/discovered candidates. */
  reason?: string | null;
}

export interface ConsultResult {
  candidates: ConsultCandidate[];
  empty_reason?: ConsultEmptyReason | null;
  /**
   * Per-recommendation id minted by kebi. The client echoes it back when the
   * user accepts/rejects (`POST /v1/signal`) or saves (`POST /v1/user/places`) a
   * candidate, so the signal attributes to that recommendation.
   */
  recommendation_id: string;
}

export interface ToolResult {
  tool: ConsultTool;
  tool_call_id: string;
  payload: ConsultResult;
}

export interface AgentResponseData {
  reasoning_steps: ReasoningStep[];
  tool_results: ToolResult[];
}

export interface ErrorResponseData {
  detail: string;
}

/** Discriminated on `type`. `tool_calls_used` feeds rate-limit accounting. */
export type ChatResponse =
  | {
      type: "agent";
      message: string;
      data: AgentResponseData | null;
      tool_calls_used: number;
    }
  | {
      type: "error";
      message: string;
      data: ErrorResponseData | null;
      tool_calls_used: number;
    };

// ── Extract place (POST /v1/extract, ADR-073) ────────────────────────────────
// Synchronous. `results` is non-empty iff status === "completed". No per-item
// status (ADR-071) and no evidence trail (ADR-093).

export type ExtractStatus = "pending" | "completed" | "failed";

/** Request body for POST /v1/extract. Identity is the X-Gateway-User-Id header. */
export interface ExtractPlaceRequest {
  raw_input: string;
}

export interface ExtractPlaceResult {
  place: PlaceCore;
  confidence: number;
}

export interface ExtractPlaceResponse {
  status: ExtractStatus;
  results: ExtractPlaceResult[];
  raw_input: string | null;
  request_id: string | null;
  failure_reason: string | null;
  failure_message: string | null;
}

// ── User library — saved places (GET /v1/user/library, ADR-071/081) ──────────
// The Library screen: a browsable, keyset-paged list of the caller's saves
// (user_places ⋈ places). `place` carries catalog fields only (same PlaceCore
// as extraction — no live rating/hours); `user_data` is this user's
// relationship to it. `user_id` is never echoed — the caller knows who they are.

/**
 * One user's relationship to a saved place. Mirrors the `user_places` row
 * (minus `user_id`). `liked` is tri-state — `null` is neutral. `source_ref`
 * is the origin URL (`null` for manual/kebi); `source_label` is the name the
 * place was shown as in the source post (`null` when it matched the canonical
 * name).
 */
export interface UserPlace {
  user_place_id: string;
  place_id: string;
  approved: boolean;
  visited: boolean;
  liked: boolean | null;
  note: string | null;
  source: PlaceSource;
  source_ref: string | null;
  source_label: string | null;
  saved_at: string;
  visited_at: string | null;
}

/** A library entry: the catalog place plus the caller's user-state. */
export interface SavedPlaceView {
  place: PlaceCore;
  user_data: UserPlace;
}

/**
 * GET /v1/user/library response. Keyset (cursor) pagination — pass
 * `next_cursor` back as `?cursor=` for the next page; `null` on the last page.
 *
 * `total` is the caller's **grand total** of saved places — the whole stash,
 * unaffected by the request's filters or pagination — for the screen's hero
 * count. `null` only during the rollout window before kebi populates it (the
 * client falls back to the loaded count).
 */
export interface LibraryResponse {
  places: SavedPlaceView[];
  next_cursor: string | null;
  total: number | null;
}

/**
 * PATCH /v1/user/places/{id} response — the full updated user-state, the same
 * shape as a library entry's `user_data`. Returning the whole object lets the
 * client replace its local row wholesale.
 */
export type LibraryUserData = UserPlace;

/**
 * PATCH /v1/user/places/{id} request body the gateway forwards to kebi. Partial
 * — only changed fields. Omitted ≠ null: an omitted field is left untouched, an
 * explicit `null` clears it (un-like to neutral, erase a note). An empty body is
 * rejected (422). Identity is the X-Gateway-User-Id header, never the body.
 */
export interface UpdateUserPlaceRequest {
  visited?: boolean;
  liked?: boolean | null;
  approved?: boolean;
  note?: string | null;
}

/**
 * POST /v1/user/places request body the gateway forwards to kebi — save a
 * place kebi recommended ("save it" on the consult card). Identity is the
 * X-Gateway-User-Id header, never the body; `source` is server-stamped (kebi).
 */
export interface SaveUserPlaceRequest {
  place_core_id: string;
  recommendation_id: string;
  /**
   * Free text stored on the save — typically the recommendation's reason the
   * client is showing (the reason is not persisted server-side, so the client
   * supplies it). Applied only on create; omit or `null` for no note.
   */
  note?: string | null;
}

// ── Home screen (greeting + recall) ─────────────────────────────────────────

/**
 * GET /v1/home — one suggestion chip. `text` is both the display label and the
 * intent the client re-submits to POST /v1/chat on tap (a chip is a first
 * message, not a separate action — it emits no taste signal on its own).
 */
export interface HomeChip {
  text: string;
}

/**
 * GET /v1/home response (ADR-111) — the home screen's opening surface: a short
 * context-aware greeting plus 3–4 suggestion chips. Fails open upstream, so the
 * call always returns this shape (a neutral greeting + generic chips on error).
 */
export interface HomeResponse {
  greeting: string;
  chips: HomeChip[];
}

/**
 * GET /v1/user/intents — one recalled intent: a past intent-bearing chat turn,
 * played back verbatim. `text` is re-submitted to POST /v1/chat on tap.
 * `created_at` is a raw ISO-8601 instant — the client renders relative phrasing,
 * since only it knows the user's timezone.
 */
export interface IntentItem {
  id: string;
  text: string;
  created_at: string;
}

/**
 * GET /v1/user/intents response (ADR-110) — the "what you wanted" recall list,
 * newest-first. Keyset (cursor) pagination — pass `next_cursor` back as
 * `?cursor=` for the next page; `null` on the last page. Empty history returns
 * `{ intents: [], next_cursor: null }`.
 */
export interface IntentsResponse {
  intents: IntentItem[];
  next_cursor: string | null;
}

// ── Auth, plan & mobility types ──────────────────────────────────────────────

export type PlanTier = "homebody" | "explorer" | "local_legend";

/**
 * How the user can get around — a stable per-user capability (licence, owned
 * vehicles, comfort), NOT a per-city availability list. kebi pairs it with the
 * working location's density each turn to resolve an effective mode. Mirrors
 * kebi's MovementMode vocabulary.
 */
export type MovementMode =
  | "walking"
  | "cycling"
  | "motorbike"
  | "driving"
  | "transit"
  | "rideshare";

export const MOVEMENT_MODES: readonly MovementMode[] = [
  "walking",
  "cycling",
  "motorbike",
  "driving",
  "transit",
  "rideshare",
] as const;

/** Willingness-to-travel baseline; shifts kebi's scope tier ±1. */
export type Reach = "compact" | "normal" | "far";

export const REACH_VALUES: readonly Reach[] = [
  "compact",
  "normal",
  "far",
] as const;

/**
 * User mobility setting. Owned by the product as a Clerk `publicMetadata`
 * claim (like `plan`); the gateway forwards it to kebi in the chat body.
 */
export interface MovementProfile {
  available_modes: MovementMode[];
  reach: Reach;
}

/**
 * Default movement profile for a new user, used until they set their own
 * (ADR-066 setter owed). The runtime value is config-driven
 * (`movement.default_profile` in the gateway's app.yaml); this is the code-level
 * fallback when that key is absent.
 */
export const DEFAULT_MOVEMENT_PROFILE: MovementProfile = {
  available_modes: ["walking", "transit"],
  reach: "normal",
};

export interface AuthUser {
  id: string;
  ai_enabled: boolean;
  plan?: PlanTier;
  movement_profile?: MovementProfile;
}

/**
 * Our per-user product settings — stored as a single JSON document in
 * `user_settings.settings` (gateway DB) and the source of truth for the claims
 * stamped into the token (ADR-045). JSON so new prefs need no migration.
 */
export interface UserSettingsData {
  plan: PlanTier;
  ai_enabled: boolean;
  movement_profile: MovementProfile | null;
}

/**
 * Product-level claims the gateway reads from an auth provider. Each provider
 * reads these from its own claim location (Clerk `public_metadata` today) and
 * returns them in a provider-agnostic shape.
 */
export interface IdentityClaims {
  ai_enabled?: boolean;
  plan?: PlanTier;
  movement_profile?: MovementProfile;
  // Our stable internal user id, stamped into the signed token claim so the
  // request path resolves identity without a DB lookup. Absent until stamped.
  internal_id?: string;
}

/**
 * Provider-agnostic identity returned by any auth provider after verifying a
 * token. `externalId` is the provider's subject (Clerk `sub`) — the lookup key
 * for the stable internal id, never forwarded to kebi.
 *
 * `email`/`name` are JWT-native PII (Supabase `email` + `user_metadata.name`),
 * surfaced only so the gateway-local profile endpoint (`GET /user/profile`) can
 * read them without an Admin-API call. They are a scoped relaxation of ADR-044
 * (client-blind-to-identity): never placed in `IdentityClaims`/`AuthUser`, and
 * never forwarded to kebi.
 */
export interface NormalizedIdentity {
  externalId: string;
  claims: IdentityClaims;
  email?: string;
  name?: string;
}

/**
 * The user's display profile, returned by the gateway-local `/user/profile`
 * endpoint to the client. `name`/`email` are Supabase-owned PII (read from the
 * JWT, written via the Admin API); `plan` mirrors the product claim. The
 * internal id is never exposed.
 */
export interface UserProfile {
  name: string;
  email: string;
  plan: PlanTier;
}

// Signal types — recommendation accept/reject only (kebi ADR-076/078).
export type SignalType =
  | "recommendation_accepted"
  | "recommendation_rejected";

/**
 * Behavioral signal body the gateway sends to kebi (POST /v1/signal).
 * `place_core_id` is kebi's `places.id` (ADR-077). Identity travels in the
 * `X-Gateway-User-Id` header, never the body.
 */
export interface SignalRequest {
  signal_type: SignalType;
  recommendation_id: string;
  place_core_id: string;
}

export interface SignalResponse {
  status: string;
}

// User data deletion scope (DELETE /v1/user/data?scope=...)
export type DataScope = "all" | "chat_history";

export const DATA_SCOPES: readonly DataScope[] = ["all", "chat_history"] as const;
