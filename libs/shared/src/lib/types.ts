import type { Location } from "../schemas/location.js";
import type { PlaceSource } from "./category-emoji.js";
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
 * `local_time` is the caller's wall-clock time, client-supplied for the same
 * reason `location` is: only the device knows the user's real clock, and a
 * server clock in another timezone answers for the wrong day. Day of week is
 * load-bearing (kebi ADR-138). `null` → kebi answers without a schedule
 * rather than guessing one.
 *
 * `movement_profile` is a user mobility setting carried as a Clerk
 * `publicMetadata` token claim (like `plan`). The gateway reads it from the
 * verified token and injects it here — the client never sends it. `null`
 * when the user has no profile set; kebi then applies a neutral fallback.
 *
 * `user_profile` is the "about me" block (kebi ADR-154), carried the same way —
 * read off the stamped settings claim, with `call_me` falling back to the
 * verified token's display name when unset. `null` when we know nothing about
 * the user. kebi consumes it as a cold-start prior and stores none of it.
 */
export interface ChatRequestDto {
  message: string;
  location: Location | null;
  /** ISO-8601 wall-clock time with offset, e.g. `2026-08-10T19:30:00+08:00`. */
  local_time: string | null;
  movement_profile: MovementProfile | null;
  user_profile: ChatUserProfile | null;
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
  /**
   * Single emoji for the place's identity (🗼, ⛲, 🌴), LLM-picked where an LLM
   * already sees the place (ADR-117). Nullable by design — LLM-less paths
   * (provider discovery) leave it `null`; the client falls back to the
   * category→emoji mapping (see `placeEmoji`).
   */
  icon: string | null;
  location: PlaceCoreLocation | null;
  created_at: string | null;
  refreshed_at: string | null;
}

// ── Chat response (POST /v1/chat) ────────────────────────────────────────────
// The agent runs a LangGraph turn with the consult-family tools plus the
// knowledge tool `research` (kebi ADR-129). Tool payloads stay server-side
// (ADR-136): what the caller renders is `message` — prose with entity names
// already wrapped as markdown links to `kebi://{kind}/{key}` — plus the flat
// `entities` list resolving each link, and the turn's `recommendation_id`.
// A new kebi tool therefore changes what the agent says, never what the client
// draws. The top-level `type` is only ever "agent" or "error" — all downstream
// failures are caught and returned as type="error" with HTTP 200 (see
// api-contract.md).

/** Which detail surface a chat link opens (kebi ADR-136). */
export type ChatEntityKind = "venue" | "area";

/**
 * One linkable entity in a chat answer — one per markdown link in `message`,
 * in the order the links appear. `kind` + `key` are `uri` pre-split so the
 * client's link handler never parses: `key` is `places.id` for a venue and the
 * slugged geo key (`{cc}[/{city}[/{neighborhood}]]`) for an area. `name` is the
 * canonical display name, which may differ from the text the answer used
 * ("Luigis" vs "Luigi's").
 */
export interface ChatEntity {
  kind: ChatEntityKind;
  key: string;
  name: string;
  /**
   * The pre-composed link. **Opaque — never rebuild it from `key`.** A venue's
   * last segment is the `places.id` `GET /v1/places/{id}` takes, but an area's
   * is its geo key run through kebi's codec (ADR-153), because the raw key is a
   * slash path and would read as URL structure. The segment a request needs is
   * therefore the one on the `uri`, not the one in `key`; `key` is the raw form,
   * kept for display and matching only.
   */
  uri: string;
  /**
   * Single emoji drawn beside the name (ADR-146). A venue's comes off its
   * catalog row, where an LLM already picked it (ADR-117); an area's is picked
   * by the turn's location resolver. **Nullable on both kinds by design** — a
   * path with no model behind it leaves it unset and the client falls back to
   * its own mapping. An area's icon is a per-conversation choice, not a stored
   * one, so the same neighbourhood may carry different emoji for two users.
   */
  icon: string | null;
}

// Tool results are gone from the wire (kebi ADR-136): the place/knowledge
// payloads stay server-side and reach the client through the detail screen a
// `kebi://` link opens. There is no `tool_results` field and no `tool_result`
// SSE frame — a new kebi tool changes what the agent says, never what the
// client draws.

export interface AgentResponseData {
  reasoning_steps: ReasoningStep[];
  /** One per `kebi://` link in `message`, in the order they appear (ADR-136). */
  entities: ChatEntity[];
  /**
   * The turn's consult id, echoed back by `POST /v1/signal` and
   * `POST /v1/user/places` so the accept/reject/save attributes to it. It moved
   * here from the consult payload when tool results left the wire (ADR-136);
   * `null` on a turn where no place tool ran.
   */
  recommendation_id: string | null;
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

/**
 * An insider note tied to a place from the knowledge layer (ADR-127) — the
 * Library's payoff surface. `id` is the claim's stable id (use as the list key
 * and, later, the agree/disagree vote target). `source` is a coarse origin
 * label: `community` (harvested from shared content), `expert` (curated), or
 * `kebi` (the user's own saved-recommendation reason). `from_shared` is `true`
 * when the note was mined from the very post the user shared for this save
 * (badge it "from what you shared"). `agree_count` / `disagree_count` are the
 * corroboration tally — both `0` until the vote write-path ships, surfaced now
 * so the client can render them without a later contract change. Approved
 * claims only, strongest first, capped.
 */
export interface PlaceNote {
  id: string;
  text: string;
  tags: string[];
  source: "community" | "expert" | "kebi";
  from_shared: boolean;
  agree_count: number;
  disagree_count: number;
}

/**
 * Any catalog place the caller can open, saved or not (ADR-151): the place, the
 * caller's relationship to it, and the place's insider notes (`claims`,
 * ADR-127). `claims` is `[]` when a place has none.
 *
 * `user_data` is `null` when the caller never saved this place — that null is
 * the place screen's "offer save" signal, and it means there is no
 * `user_place_id` to PATCH or DELETE, so every user-state affordance is absent.
 * `GET /v1/places/{id}` returns this shape; `GET /v1/user/library` returns the
 * saved narrowing below.
 */
export interface PlaceView {
  place: PlaceCore;
  user_data: UserPlace | null;
  claims: PlaceNote[];
}

/**
 * A library entry — a {@link PlaceView} the caller has saved. Carries
 * `user_place_id`, so the mutating surfaces (Library pills, place menu, note
 * sheet) take this type and keep their non-null guarantee.
 */
export interface SavedPlaceView extends PlaceView {
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
 * POST /v1/user/places request body the gateway forwards to kebi — the plain
 * "save" on the place screen (ADR-151). Identity is the X-Gateway-User-Id
 * header, never the body; `source` is server-stamped (kebi).
 *
 * The place id is the whole body. No attribution rides along: the only way a
 * client holds a `places.id` is off a `kebi://venue/{id}` link kebi produced, so
 * calling this endpoint at all is what marks the save as kebi-recommended. The
 * retired card's `recommendation_id`/`reason` are now rejected as unknown keys.
 */
export interface SaveUserPlaceRequest {
  place_core_id: string;
}

// ── Area screen (GET /v1/areas/{id}) ────────────────────────────────────────
// The surface behind every `kebi://area/{id}` link (kebi ADR-153). The response
// splits in two: a **global half** (the profile — generated once on first open,
// identical for every caller) and a **personal half** (`saved_count` and the
// body `section` — composed per request, never stored), the same split ADR-151
// made on the place screen with its nullable `user_data`.

/** One "best for" chip on the area profile. */
export interface AreaChip {
  icon: string | null;
  text: string;
}

/** One tappable ancestor — `indonesia › bali` above the Canggu header. */
export interface AreaBreadcrumbItem {
  /** Raw geo key (`id/bali`). */
  key: string;
  name: string;
  /** `kebi://area/{encoded key}` — hand back to the link handler, never parse. */
  uri: string;
}

/**
 * A child-area row in the body section. `saved_count` is the caller's own saves
 * under that key — the drill-down promise that makes the row worth tapping —
 * and is 0 on a "worth knowing" row.
 */
export interface AreaSubArea {
  key: string;
  name: string;
  uri: string;
  icon: string | null;
  /** One-line profiler hook, on "worth knowing" rows. */
  hook: string | null;
  saved_count: number;
}

/**
 * A venue row in the body section — only ever the caller's own saves.
 * `subtitle` is server-composed from catalog data; `liked`/`visited` are the
 * caller's pill state, for the row's accents.
 */
export interface AreaVenueRow {
  /** `places.id` — opens the place screen. */
  id: string;
  name: string;
  uri: string;
  icon: string | null;
  subtitle: string | null;
  liked: boolean | null;
  visited: boolean;
}

/**
 * The one body block below the profile.
 *
 * `saved` — the caller's footprint here: child-area rows at wide levels, venue
 * rows at the leaf (both can appear when a save carries no geo deeper than the
 * current level). `worth_knowing` — the profiler's notable children, shown only
 * when the caller has no saves under the key. Never venue suggestions:
 * discovery stays in chat.
 */
export interface AreaSection {
  kind: "saved" | "worth_knowing";
  areas: AreaSubArea[];
  places: AreaVenueRow[];
}

/**
 * One area as the client renders it (kebi ADR-153).
 *
 * `profiled: false` means the global half is still being generated — the open
 * that returned this response is what triggered it — so `level`/`icon`/`summary`
 * are null, `best_for` is empty, and `name`/`breadcrumb` are slug-derived
 * fallbacks. The dressed screen is there within seconds on the next fetch, the
 * same first-open contract as a thin place (ADR-152). The personal half is
 * always live, thin or not. `section` is null when there is nothing to show
 * below the profile.
 */
export interface AreaScreenView {
  /** Raw geo key (`id/bali/canggu`) — also what the chat entity carries. */
  key: string;
  /** This area's own `kebi://area/{encoded key}`. */
  uri: string;
  name: string;
  level: string | null;
  icon: string | null;
  summary: string | null;
  best_for: AreaChip[];
  breadcrumb: AreaBreadcrumbItem[];
  saved_count: number;
  profiled: boolean;
  section: AreaSection | null;
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
 * Whether a human ever chose the movement profile's modes, or a config seed
 * supplied them (kebi ADR-155). Only `user` counts as resolved: kebi ignores a
 * seeded block's modes and substitutes its own deliberately wide fallback
 * (ADR-156), because capping an unknown user at walking range hides places they
 * never learn about. Absent reads as `default` upstream.
 */
export type MovementSource = "user" | "default";

export const MOVEMENT_SOURCES: readonly MovementSource[] = [
  "user",
  "default",
] as const;

/**
 * User mobility setting. Owned by the product as a Clerk `publicMetadata`
 * claim (like `plan`); the gateway forwards it to kebi in the chat body.
 */
export interface MovementProfile {
  available_modes: MovementMode[];
  reach: Reach;
  /** Absent is read as `default` by kebi — only a setter writes `user`. */
  source?: MovementSource;
}

/**
 * Default movement profile for a new user, used until they set their own. The
 * runtime value is config-driven (`user_settings.defaults.movement_profile` in
 * the gateway's app.yaml); this is the code-level fallback when that key is
 * absent. `source` is `default` by construction — these modes are ours, not the
 * user's, and marking them `user` would have kebi honour a cap nobody chose.
 */
export const DEFAULT_MOVEMENT_PROFILE: MovementProfile = {
  available_modes: ["walking", "transit"],
  reach: "normal",
  source: "default",
};

/**
 * The user's stored "about me" (kebi ADR-154), owned by `user_settings` and
 * stamped into the token claims like `movement_profile`. Both fields nullable —
 * a cleared field is `null`, never an empty string, so nothing reaches kebi as
 * prose the user did not write.
 *
 * `call_me` lives here and only here — one write, to our own row, rather than a
 * round-trip to the auth provider's Admin API for a name kebi is the one asking
 * for. The account display name stays what it is (login identity, avatar); an
 * unset `call_me` falls back to it at forward time, so a user who never opens
 * the form is still addressed by name.
 */
export interface UserAboutMe {
  call_me: string | null;
  /** ISO 3166-1 alpha-2, uppercase. Validated at the gateway edge. */
  home_country: string | null;
  about: string | null;
}

/**
 * The `user_profile` block on the kebi chat body — the stored about-me as sent,
 * with `call_me` falling back to the account display name when unset. kebi
 * weighs `about` as a low-trust cold-start prior (except a stated restriction,
 * read as a hard constraint) and answers entry/visa questions live when
 * `home_country` is present. It stores none of it.
 */
export type ChatUserProfile = UserAboutMe;

/**
 * The caller's own settings, read back for the screens that edit them
 * (gateway-local `GET /user/settings`). They ride the token as an opaque sealed
 * claim (ADR-044/045), so a screen has nowhere else to read current values from
 * — and the about-me writes whole, so opening blind would erase what was there.
 * `null` on either field means unset.
 */
export interface UserSettingsResponse {
  about_me: UserAboutMe | null;
  movement_profile: MovementProfile | null;
}

export interface AuthUser {
  id: string;
  ai_enabled: boolean;
  plan?: PlanTier;
  movement_profile?: MovementProfile;
  /** Stamped about-me claim; absent until the user sets one. */
  about_me?: UserAboutMe;
  // Admin-granted curator role (ADR-121), carried claim-first in the token.
  // Absent on a pre-grant/pre-migration token → treated as not a curator.
  can_curate?: boolean;
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
  /**
   * The user's about-me (kebi ADR-154). `null` until they write one — a row
   * predating the field reads as null and forwards nothing.
   */
  about_me: UserAboutMe | null;
  // Admin-granted curator role (ADR-121 knowledge curation) — independent of the
  // billing plan, never self-asserted. Defaults false (fail closed); the gateway
  // forwards it as the X-Gateway-Can-Curate capability header.
  can_curate: boolean;
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
  /** Stamped from user_settings; absent until the user sets an about-me. */
  about_me?: UserAboutMe;
  // Admin-granted curator role (ADR-121), stamped from user_settings.
  can_curate?: boolean;
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

// The accept/reject signal types retired with the recommendation card that fed
// them (ADR-151): kebi deleted POST /v1/signal, so there is nothing to send.
// Negative taste input now comes only from the Library pills.

// Knowledge curation (POST /v1/knowledge/curate) — ADR-121. Expert prose is
// structured by kebi into geo-scoped `curated_expert` claims.
export type CurateScope = "country" | "city" | "neighborhood";

export interface CurateClaim {
  scope: CurateScope;
  entity_name: string;
  claim: string;
  tags: string[];
}

/**
 * kebi's response after structuring curated prose. `claims_written` counts only
 * NEW rows — dedup collapses re-submissions, and unkeyable/accessibility claims
 * are dropped, so it may be less than the prose implied. `claims` is empty when
 * nothing was stored.
 */
export interface CurateKnowledgeResponse {
  claims_written: number;
  claims: CurateClaim[];
}

// User data deletion scope (DELETE /v1/user/data?scope=...)
export type DataScope = "all" | "chat_history";

export const DATA_SCOPES: readonly DataScope[] = ["all", "chat_history"] as const;

// In-app feedback (POST /api/v1/feedback) — ADR-051. Gateway-only: stamps the
// verified user id + token-claim email and forwards to a Notion database.
// Never reaches kebi, never stored in the gateway DB.
export type FeedbackKind = "wrong_answer" | "extraction" | "bug" | "message";

export const FEEDBACK_KINDS: readonly FeedbackKind[] = [
  "wrong_answer",
  "extraction",
  "bug",
  "message",
] as const;

export type FeedbackCategory = "wrong_place" | "didnt_get_me" | "missing_info";

export const FEEDBACK_CATEGORIES: readonly FeedbackCategory[] = [
  "wrong_place",
  "didnt_get_me",
  "missing_info",
] as const;

/**
 * One transcript turn attached to a `wrong_answer` report. Deliberately lean:
 * turn text and reasoning step titles only — never tool payloads (large,
 * PII-adjacent, and beyond what the in-app disclosure promises). Tool names
 * left with them: the client no longer sees which tools ran (ADR-136), and the
 * step titles say what happened in words a reader can act on.
 */
export interface FeedbackTranscriptTurn {
  role: "you" | "kebi";
  text: string;
  at: string;
  step_titles?: string[];
}

/**
 * One recorded save attempt attached to an `extraction` report: the raw
 * link/text the user submitted and a one-line summary of what kebi made of it
 * (saved place names, or the failure reason).
 */
export interface FeedbackSaveAttempt {
  input: string;
  result: string;
  at: string;
}

/**
 * Feedback body the client sends to the gateway. Identity is never a body
 * field (stamped server-side from the verified token). `category`, `exchange`,
 * and `transcript` travel only on `wrong_answer` reports; `input` and
 * `save_attempts` only on `extraction` reports.
 */
export interface FeedbackRequest {
  kind: FeedbackKind;
  text?: string;
  /** Manual fallback: the link/text the save was about (no recorded attempts). */
  input?: string;
  save_attempts?: FeedbackSaveAttempt[];
  category?: FeedbackCategory;
  exchange?: { you: string; kebi: string };
  transcript?: FeedbackTranscriptTurn[];
  app_version?: string;
  platform?: "ios" | "android";
  os_version?: string;
  device?: string;
}

export interface FeedbackResponse {
  status: "received";
}
