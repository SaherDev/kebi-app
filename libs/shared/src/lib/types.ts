import type { Location } from "../schemas/location.js";
import type { PlaceCategory, PlaceTag } from "./place-taxonomy.js";

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

export type ClientIntent = "consult" | "recall" | "save" | "assistant";

export interface ReasoningStep {
  step: string;
  summary: string;
  source?: "tool" | "agent" | "fallback";
  tool_name?: "recall" | "save" | "consult" | null;
  visibility?: "user" | "debug";
  duration_ms?: number;
  timestamp?: string;
}

// ── Unified place shape (ADR-054) ────────────────────────────────────────────

export type PlaceType =
  | "food_and_drink"
  | "things_to_do"
  | "shopping"
  | "services"
  | "accommodation";

export type PlaceSource =
  | "tiktok"
  | "instagram"
  | "youtube"
  | "google_maps"
  | "manual";

export interface PlaceLocationContext {
  neighborhood: string | null;
  city: string | null;
  country: string | null;
}

export interface PlaceAttributes {
  cuisine: string | null;
  price_hint: string | null;
  ambiance: string | null;
  dietary: string[];
  good_for: string[];
  location_context: PlaceLocationContext | null;
}

export interface PlaceHours {
  sunday?: string | null;
  monday?: string | null;
  tuesday?: string | null;
  wednesday?: string | null;
  thursday?: string | null;
  friday?: string | null;
  saturday?: string | null;
  timezone: string;
}

/**
 * Unified place object returned by every read and write path (ADR-054).
 * Tier 1 fields from PostgreSQL are always present; Tier 2 (Redis geo) and
 * Tier 3 (Redis enrichment) populate only when `enrich_batch` ran.
 */
export interface PlaceObject {
  // Tier 1 — always present
  place_id: string;
  place_name: string;
  place_type: PlaceType;
  subcategory: string | null;
  tags: string[];
  attributes: PlaceAttributes;
  source_url: string | null;
  source: PlaceSource | null;
  provider_id: string | null;
  created_at: string | null;

  // Tier 2 — Redis geo cache
  lat: number | null;
  lng: number | null;
  address: string | null;
  geo_fresh: boolean;

  // Tier 3 — Redis enrichment
  hours: PlaceHours | null;
  rating: number | null;
  phone: string | null;
  photo_url: string | null;
  popularity: number | null;
  enriched: boolean;
}

// ── PlaceCore — canonical place shape on the new kebi contract ───────────────
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

// ── Consult (POST /v1/chat, type="consult") ──────────────────────────────────

export type ConsultResultSource = "saved" | "discovered" | "suggested";

export interface ConsultResult {
  place: PlaceObject;
  source: ConsultResultSource;
}

export interface ConsultResponseData {
  recommendation_id: string | null;
  results: ConsultResult[];
  reasoning_steps: ReasoningStep[];
}

// ── Recall (POST /v1/chat, type="recall") ────────────────────────────────────

export type RecallMatchReason =
  | "filter"
  | "semantic"
  | "keyword"
  | "semantic + keyword";

export type RecallScoreType = "rrf" | "ts_rank";

export interface RecallResult {
  place: PlaceObject;
  match_reason: RecallMatchReason;
  relevance_score: number | null;
  score_type: RecallScoreType | null;
}

export interface RecallResponseData {
  results: RecallResult[];
  total_count: number;
  empty_state: boolean;
}

// ── Extract place (POST /v1/chat, type="extract-place") ──────────────────────

export type ExtractPlaceStatus =
  | "saved"
  | "needs_review"
  | "duplicate"
  | "pending"
  | "failed";

export interface ExtractPlaceItem {
  place: PlaceObject | null;
  confidence: number | null;
  status: ExtractPlaceStatus;
}

export interface ExtractPlaceData {
  results: ExtractPlaceItem[];
  source_url: string | null;
  request_id: string | null;
}

// ── Extract place — new contract (POST /v1/extract, ADR-073) ─────────────────
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

// ── Local UI/storage types (not on the wire) ─────────────────────────────────

export interface SavedPlaceStub {
  place_id: string;
  place_name: string;
  address: string;
  saved_at: string;
  source_url: string | null;
  thumbnail_url?: string;
}

export interface SaveSheetPlace {
  name: string;
  source: string;
  location: string;
  thumbnail_url?: string;
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
