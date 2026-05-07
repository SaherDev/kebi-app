# Feature Specification: Signal & User Context Gateway Endpoints

**Feature Branch**: `014-signal-context-endpoints`
**Created**: 2026-04-17
**Status**: Draft
**Input**: User description: Three changes in services/api — consult response carries `recommendation_id`, new `GET /api/v1/user/context`, new `POST /api/v1/signal`.
**Upstream contract**: FastAPI `022-recommendations-context-signals` (dated 2026-04-17) — pasted into the clarify session by the product owner; treated as authoritative for this feature.

## Clarifications

### Session 2026-04-17

- Q: Should the `GET /api/v1/user/context` response use snake_case, camelCase, or the mixed casing in the original task description? → A: All snake_case on the wire (`user_id`, `saved_places_count`, `chips[].label`, `source_field`, `source_value`, `signal_count`), matching every other AI-boundary contract in this repo.
- Q: Apply `@RequiresAi()` (ADR-022 kill switch + per-user flag guard) to the new `/signal` and `/user/context` endpoints? → A: Yes, apply to both — uniform guard policy across every endpoint that forwards to kebi.
- Q: Where should the AI-service 404 (unknown `recommendation_id`) be translated to a caller-facing 404? → A: Extend `AllExceptionsFilter` globally to map upstream 404 → 404; no route-local exception handling in the signal controller or service.
- Q: Should `user_id` appear in the `GET /v1/user/context` response body? → A: No — it was a mistake in the earlier task description. The response is `{ saved_places_count, chips }`; the caller already knows its own Clerk ID. FastAPI will drop the field on its side; the gateway forwards whatever FastAPI returns without transformation.
- Q: `savedPlacesCount` (camelCase) in the FastAPI contract vs. `saved_places_count` (snake_case) agreed in Q1 — how to resolve? → A: Treat it as a second upstream typo in the same draft contract. FastAPI renames its field to `saved_places_count`; the gateway remains a pure pass-through with no per-field transformation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Identify the recommendation the user just saw (Priority: P1)

When the user receives a place recommendation from the AI, the response now carries a stable identifier (`recommendation_id`) at the top level of the consult payload. This identifier is what the client later references when the user reacts to that specific recommendation (accepts it, rejects it, or dismisses it). Without it, no meaningful feedback loop can exist between what the AI showed and what the user did about it.

**Why this priority**: Both of the other stories (signal reporting, context chips) depend on this identifier existing on every consult response. Without P1, feedback cannot be attributed to a specific recommendation.

**Independent Test**: Send a consult-intent message through `POST /api/v1/chat`. Verify the JSON response includes `data.recommendation_id` as a non-empty string, regardless of whether the primary place came from the user's saved list or was discovered.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** they send a consult message (e.g. "cheap dinner nearby"), **Then** the chat response contains `recommendation_id` as a string inside the consult payload.
2. **Given** the AI service has assigned an ID to the returned recommendation, **When** NestJS forwards the response to the frontend, **Then** the `recommendation_id` value is identical on both sides (the gateway does not strip or rewrite it).
3. **Given** a non-consult response type (assistant, clarification, recall, extract-place), **When** returned to the frontend, **Then** its behavior is unchanged — `recommendation_id` is a consult-specific field.

---

### User Story 2 — Report user reactions to a recommendation (Priority: P2)

When the user accepts or rejects a recommendation shown to them, the client posts a signal to the gateway. The gateway verifies the caller, injects the Clerk user ID, and forwards the signal to the AI service. The AI service uses these signals to learn the user's taste model over time. The gateway itself does not store signals — it is a pass-through.

**Why this priority**: Depends on P1 (a `recommendation_id` must exist). The feedback loop is what makes the taste model improve. It must be reliable but is not blocking to the first meaningful AI interaction.

**Independent Test**: After a consult response is received, POST `/api/v1/signal` with `signal_type: recommendation_accepted`, the returned `recommendation_id`, and a `place_id`. Verify a `202 Accepted` is returned. Repeat with `signal_type: recommendation_rejected` — verify the same. Finally send a request with a `recommendation_id` the AI service does not recognize — verify a `404 Not Found` is returned.

**Acceptance Scenarios**:

1. **Given** an authenticated user and a valid `recommendation_id`, **When** POST `/api/v1/signal` is called with `signal_type: recommendation_accepted`, `recommendation_id`, and `place_id`, **Then** the gateway returns `202 Accepted`.
2. **Given** an authenticated user and a valid `recommendation_id`, **When** POST `/api/v1/signal` is called with `signal_type: recommendation_rejected`, **Then** the gateway returns `202 Accepted`.
3. **Given** an unknown `recommendation_id`, **When** POST `/api/v1/signal` is called, **Then** the gateway returns `404 Not Found`.
4. **Given** an unauthenticated request, **When** POST `/api/v1/signal` is called, **Then** the gateway rejects it with `401 Unauthorized`.
5. **Given** a malformed body (missing `recommendation_id`, unknown `signal_type` value, missing `place_id`), **When** POST `/api/v1/signal` is called, **Then** the gateway returns `400 Bad Request` without forwarding.
6. **Given** a valid signal, **When** forwarded to the AI service, **Then** the NestJS-injected `user_id` (from the Clerk token) is present in the payload — the caller cannot spoof it.

---

### User Story 3 — Show the user what the AI knows about them (Priority: P3)

When the frontend wants to display a "what the AI has learned about you" surface (e.g. onboarding chip cloud, taste summary), it calls `GET /api/v1/user/context`. The gateway authenticates the caller, pulls their Clerk user ID, asks the AI service for the current context summary, and returns it. The response is a simple JSON object with the user's ID, how many places they have saved, and an array of "chip" facts the AI has extracted from their history.

**Why this priority**: Transparency feature. Useful for trust and UX but does not block the core save → consult → accept/reject loop. Ships last of the three.

**Independent Test**: Call `GET /api/v1/user/context` as an authenticated user. Verify the JSON includes `user_id`, `savedPlacesCount` (a number), and `chips` (an array, possibly empty).

**Acceptance Scenarios**:

1. **Given** an authenticated user with zero saved places, **When** `GET /api/v1/user/context` is called, **Then** the response includes `saved_places_count: 0` and `chips: []`. The caller's user ID is derived from the Clerk token and is not echoed back in the body.
2. **Given** an authenticated user with saved places and taste signals, **When** `GET /api/v1/user/context` is called, **Then** each chip in the response has `label`, `source_field`, `source_value`, and `signal_count` fields.
3. **Given** an unauthenticated request, **When** `GET /api/v1/user/context` is called, **Then** the gateway rejects it with `401 Unauthorized`.
4. **Given** the AI service is down or slow, **When** `GET /api/v1/user/context` is called, **Then** the gateway returns `503 Service Unavailable` within the configured timeout window (not an indefinite hang).

---

### Edge Cases

- **Consult response with `recommendation_id: null`**: FastAPI returns `null` when its recommendations-table persist step failed. The gateway returns HTTP 200 as normal; the frontend must disable the accept/reject affordance for that recommendation (no signal can be posted without a valid ID).
- **Signal posted before any consult has happened**: The user has no valid `recommendation_id` yet. Client code should not allow this; if the gateway still receives it, the unknown `recommendation_id` path (404) applies.
- **Signal posted twice for the same recommendation**: Idempotency is the AI service's concern, not the gateway's. The gateway forwards both and returns 202 both times unless the AI service signals otherwise.
- **`place_id` does not match the recommendation**: The gateway does not validate the place-to-recommendation relationship. The AI service is responsible for any such validation. If it rejects the pairing, the gateway surfaces that outcome.
- **Empty or near-empty user context**: A brand-new user with zero saves still gets a valid response shape (`saved_places_count: 0`, `chips: []`). Never an error for absence of data. The caller's user ID is not echoed in the body.
- **AI kill switch active (ADR-022)**: When the global kill switch is on, all three endpoints that forward to the AI service behave consistently — they apply the same guard and reject the request the same way.

## Requirements *(mandatory)*

### Functional Requirements

**Consult response — recommendation_id**

- **FR-001**: The consult payload inside `ChatResponseDto.data` MUST include a top-level `recommendation_id: string | null` field sourced from the AI service response. `null` is a legitimate value (FastAPI returns null when its recommendations-table persist step failed); the frontend must handle null defensively (no signal can be posted for a null-id recommendation).
- **FR-002**: The gateway MUST NOT strip, rename, transform, or inject the `recommendation_id` value; it is a pass-through field.
- **FR-003**: The shared TypeScript contract in `libs/shared` MUST expose `recommendation_id: string | null` on the consult response type so both frontend and backend consume the same definition.

**POST /api/v1/signal**

- **FR-004**: The gateway MUST expose `POST /api/v1/signal` behind Clerk authentication and the `@RequiresAi()` guard (ADR-022); unauthenticated callers receive `401 Unauthorized`, kill-switched requests receive `503`, and callers with `ai_enabled: false` receive `403`.
- **FR-005**: The request body MUST be validated as a discriminated union on `signal_type`, accepting only `recommendation_accepted` or `recommendation_rejected`. Any other value is rejected with `400 Bad Request`.
- **FR-006**: The request body MUST require `recommendation_id: string` and `place_id: string` as non-empty values.
- **FR-007**: The gateway MUST inject the authenticated Clerk `user_id` into the forwarded payload — the caller cannot provide or override it.
- **FR-008**: The gateway MUST forward the enriched payload to the AI service via a dedicated client method, not via raw HTTP calls in the controller or service.
- **FR-009**: On successful forwarding, the gateway MUST return `202 Accepted` and pass the AI service response body through as-is (FastAPI returns `{"status": "accepted"}`). The gateway does not synthesize or strip a body.
- **FR-010**: If the AI service returns `404 Not Found` (unknown `recommendation_id`), the gateway MUST surface it as `404 Not Found` to the caller. Translation happens in the global `AllExceptionsFilter` (ADR-018) — extended in this feature to include upstream 404 → 404 mapping — not in the signal controller or service.
- **FR-011**: The controller for this route MUST be a facade — exactly one service call, no business logic, no DB access, no direct AI client calls.

**GET /api/v1/user/context**

- **FR-012**: The gateway MUST expose `GET /api/v1/user/context` behind Clerk authentication and the `@RequiresAi()` guard (ADR-022); unauthenticated callers receive `401 Unauthorized`, kill-switched requests receive `503`, and callers with `ai_enabled: false` receive `403`.
- **FR-013**: The request body MUST be absent. The user identifier is derived from the Clerk token only.
- **FR-014**: The gateway MUST forward to the AI service via a dedicated client method for `GET /v1/user/context`, supplying the Clerk `user_id` as a query parameter (`?user_id=…`) per the FastAPI contract.
- **FR-015**: The response MUST be a JSON object with two top-level keys:
  - `saved_places_count: number`
  - `chips: Array<{ label: string; source_field: string; source_value: string; signal_count: number }>`
  The caller's user ID is not echoed in the response body — the frontend already knows its own Clerk user ID.
- **FR-016**: The response shape MUST be defined in `libs/shared` as `UserContextResponse` matching the wire contract, so the frontend consumes the same type without field remapping.
- **FR-017**: The controller for this route MUST be a facade — exactly one service call, no transformation, no DB access. The gateway passes the AI service response through as-is; no per-field casing transformation is applied.
- **FR-018**: A user with zero saved places and zero taste signals MUST receive a valid response (`saved_places_count: 0`, `chips: []`) — never an error for absence of data.

*(Two upstream typos in the pasted FastAPI contract are resolved in Clarify: `user_id` in the response body is removed, and `savedPlacesCount` is renamed to `saved_places_count`. Both are FastAPI-side fixes; the gateway does not transform either. If the current FastAPI build still emits them, that is an upstream bug — not a gateway transformation point.)*

**Architectural constraints (binding for all three tasks)**

- **FR-019**: The gateway MUST NOT write any recommendation, signal, or context data to its own database. The recommendations table is owned by the AI service (per the architecture doc and ADR-036). Any existing NestJS code that writes recommendation rows MUST be flagged and removed; no Prisma/TypeORM migration changes for the recommendations table happen in this feature.
- **FR-020**: All AI service calls MUST go through the existing `AiServiceClient` abstraction. No new `fetch`/`axios` imports appear in controllers or services; the HTTP library stays encapsulated in the AI service module.
- **FR-021**: Every new endpoint MUST have a corresponding Bruno request file in `kebi-config/bruno/nestjs-api/`. For signal, the Bruno collection MUST include both `recommendation_accepted` and `recommendation_rejected` example requests.
- **FR-022**: The `AiServiceClient` contract (`IAiServiceClient`) MUST be extended with two new methods — one for user context, one for signal — so the concrete implementation is swappable and the interface-first rule (ADR-033) is honored.

### Key Entities *(include if feature involves data)*

- **Recommendation**: A single AI-returned suggestion within a consult response. Key attribute: a stable `recommendation_id` assigned by the AI service. Owned by the AI service; the gateway never mints or mutates it.
- **Signal**: A user reaction to a specific recommendation. Carries a `signal_type`, the `recommendation_id` it concerns, the `place_id` it was about, and the authenticated `user_id` (injected by the gateway). Persisted by the AI service; the gateway only forwards.
- **User Context Chip**: A short, human-readable fact the AI has extracted about the user (e.g. "likes ramen"). Has a display `label`, the `source_field` it was derived from, the `source_value` that produced it, and a `signal_count` indicating how many interactions reinforced it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of consult-intent chat responses include a `recommendation_id` key in the consult payload — value is either a string (happy path) or `null` (FastAPI persist failure). The key is never absent.
- **SC-002**: A signal posted with a valid `recommendation_id` returns `202 Accepted` within 2 seconds under normal AI-service load.
- **SC-003**: A signal posted with an unknown `recommendation_id` returns `404 Not Found` — never `202`, `500`, or an indefinite hang.
- **SC-004**: `GET /api/v1/user/context` returns a shape-valid JSON response (all required fields present, correct types) for every authenticated user, including brand-new users with zero saves.
- **SC-005**: The gateway performs no database writes for signals or recommendations — verifiable by code inspection and absence of ORM entities for these concerns.
- **SC-006**: All three endpoints pass `pnpm nx test api`, `pnpm nx lint api`, and `pnpm nx build api` on the feature branch before merge.
- **SC-007**: Each new endpoint is represented by a working Bruno request file that, when run against a local dev environment, produces the expected response per the scenarios above.

## Assumptions

- **AI kill switch**: All three forwarding endpoints (`/chat`, `/signal`, `/user/context`) apply the `@RequiresAi()` guard per ADR-022 (confirmed in Clarify). If the global kill switch is active or the user's `ai_enabled` flag is false, the endpoints reject consistently with 503/403.
- **Forwarding timeout for `/signal` and `/user/context`**: Reuse the existing 30-second timeout convention from `AiServiceClient.chat()` unless measurement justifies a lower bound. Both endpoints are expected to respond in under 2 seconds in practice; the 30s cap is a safety net.
- **404 surfacing**: The AI service returns HTTP 404 when a `recommendation_id` is unknown. `AllExceptionsFilter` (ADR-018) is extended in this feature with a new global rule — upstream 404 → caller-facing 404 — which applies to `/signal` today and any future gateway endpoint whose upstream can legitimately return 404. Confirmed in Clarify.
- **Signal response body**: Per FastAPI contract, the AI service returns `{"status": "accepted"}`. The gateway passes this body through with status 202 — no synthesis, no stripping.
- **`user_id` transport to AI service for `/user/context`**: Confirmed by the FastAPI contract — query parameter `?user_id=…`. Not a planning-phase decision.
- **Forward-compatible DTOs (ADR-019)**: Shared DTOs remain tolerant of unknown fields. `recommendation_id` being absent from an older AI service response does not crash the frontend.
- **No Prisma code to remove**: A scan of `services/api` found no Prisma client usage and no recommendation-writing code. ADR-036 already deleted the `RecommendationsModule`. The "remove any recommendation writes" step is a confirmation, not a change.

## Dependencies

- The AI service (`kebi`) must implement the matching endpoints (`POST /v1/signal`, `GET /v1/user/context`) and must start including `recommendation_id` in its `POST /v1/chat` consult responses. Without this, the gateway endpoints return pass-through payloads that are incomplete or produce 5xx on forwarding. The AI-repo change set is out of scope for this spec but is a hard prerequisite for end-to-end testing.
- The existing NestJS gateway infrastructure — `AiServiceClient`, `ClerkMiddleware`, `AiEnabledGuard`, `AllExceptionsFilter`, global `ValidationPipe` — is assumed to be in place and working per ADRs 013, 017, 018, 022, 032, 033, 036.
- Bruno collection directory `kebi-config/bruno/nestjs-api/` already exists and uses the established `.bru` file format.

## Out of Scope

- Any frontend wiring — calling the new endpoints from `apps/web`, rendering chips, UI for accept/reject buttons.
- Schema cleanup of any dormant `recommendations` table in this repo (flagged separately if any such table still exists in a local DB).
- SSE/streaming on any of the three endpoints; all are plain JSON request/response.
- Rate limiting, retry policies, or idempotency keys on `/signal`.
- Persisting a local cache of user context in NestJS; the gateway is stateless for this feature.
- Changing the `POST /v1/chat` contract beyond adding `recommendation_id` to the consult payload.
