import type { Location } from "../schemas/location.js";
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
 * {@link SseReasoningStep} in `types/sse`. Tool identity is NOT here — it
 * travels on {@link ToolResult.tool} (ADR-075 removed the `"tool"` source).
 */
export interface ReasoningStep {
  step: string;
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

export interface AuthUser {
  id: string;
  ai_enabled: boolean;
  plan?: PlanTier;
  movement_profile?: MovementProfile;
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
 */
export interface NormalizedIdentity {
  externalId: string;
  email?: string;
  claims: IdentityClaims;
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
