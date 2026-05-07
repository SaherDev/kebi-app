# Feature Specification: Wire Recall Proxy to kebi

**Feature Branch**: `009-recall-proxy`
**Created**: 2026-03-31
**Status**: Draft
**Input**: Wire POST /v1/recall in NestJS to forward to kebi. Replace 501 stub with working proxy.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Successful Recall Query (Priority: P1)

A client calls `POST /api/v1/recall` with a natural language memory fragment and user identity. The system forwards the request to kebi, receives matching saved places, and returns them to the caller.

**Why this priority**: Core feature delivery — the 501 stub blocks any recall functionality. This is the primary success path.

**Independent Test**: Send a valid recall request to `POST /api/v1/recall` with `{ "query": "that ramen place I saved from TikTok", "user_id": "user_123" }`. Verify the response matches the shape returned by kebi (results array + total count).

**Acceptance Scenarios**:

1. **Given** a valid recall request body with `query` and `user_id`, **When** `POST /api/v1/recall` is called, **Then** the request is forwarded to kebi's `POST /v1/recall` with the same body
2. **Given** kebi returns a valid recall response, **When** NestJS receives it, **Then** the exact response is returned to the caller with HTTP 200
3. **Given** a valid request is forwarded, **When** kebi returns an empty results array, **Then** `{ "results": [], "total": 0 }` is returned with HTTP 200

---

### User Story 2 - kebi Unreachable (Priority: P2)

When kebi is down or times out, the caller receives a clean, human-readable 503 error instead of a raw network exception or stack trace.

**Why this priority**: Error handling is a user-facing requirement. A raw connection error leaking to the client is unacceptable.

**Independent Test**: Point the AI service URL at an invalid host, then call `POST /api/v1/recall`. Verify the response is HTTP 503 with a readable `message` field.

**Acceptance Scenarios**:

1. **Given** kebi is unreachable (connection refused or timeout), **When** `POST /api/v1/recall` is called, **Then** the response is HTTP 503 with body `{ "statusCode": 503, "message": "service temporarily unavailable, please retry" }`
2. **Given** kebi returns HTTP 500, **When** NestJS receives it, **Then** the caller receives HTTP 503 with a readable message (not the raw kebi error body)
3. **Given** a network timeout occurs, **When** the HTTP client timeout is exceeded, **Then** the response is HTTP 503 with a readable message

---

### User Story 3 - Invalid Request Body (Priority: P3)

Requests missing required fields are rejected before forwarding to kebi.

**Why this priority**: Prevents malformed requests from reaching the AI service.

**Independent Test**: Send `POST /api/v1/recall` with an empty body or missing `query`. Verify HTTP 400 is returned without calling kebi.

**Acceptance Scenarios**:

1. **Given** a request body with no `query` field, **When** `POST /api/v1/recall` is called, **Then** HTTP 400 is returned with a validation error message
2. **Given** a request body with an empty string `query`, **When** `POST /api/v1/recall` is called, **Then** HTTP 400 is returned

---

### Edge Cases

- What happens when kebi returns a non-200 status code? 400 and 422 pass through as-is; 5xx maps to 503 via `AllExceptionsFilter`.
- How does the system handle a kebi response that exceeds the configured timeout? Returns HTTP 503.
- What happens when `user_id` is missing from the body? Validation rejects with HTTP 400 (no forwarding).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST forward the full `{ query, user_id }` request body to kebi's `POST /v1/recall` without modification
- **FR-002**: System MUST return kebi's response directly to the caller with HTTP 200 on success
- **FR-003**: System MUST return HTTP 503 with a human-readable message when kebi is unreachable or returns a 5xx response; 400 and 422 from kebi pass through as-is
- **FR-004**: System MUST reject requests missing a `query` or `user_id` field with HTTP 400 before forwarding
- **FR-005**: System MUST remove the 501 stub — the endpoint must no longer return `HttpCode(501)` or throw `NotImplementedException`
- **FR-006**: System MUST NOT implement any search, ranking, or filtering logic — all intelligence lives in kebi
- **FR-007**: System MUST load the kebi base URL from YAML config (`ai_service.base_url`), not hardcoded values

### Key Entities

- **RecallRequest**: `{ query: string, user_id: string }` — forwarded as-is to kebi
- **RecallResponse**: `{ results: RecallPlace[], total: number }` — returned as-is from kebi
- **RecallPlace**: `{ place_id, place_name, address, cuisine, price_range, source_url, saved_at, match_reason }` — defined in api-contract.md

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A valid recall request reaches kebi and the caller receives the unmodified response — no data is added, removed, or transformed
- **SC-002**: When kebi is unreachable, 100% of recall requests return HTTP 503 with a human-readable `message` field (no raw network errors or stack traces exposed to callers)
- **SC-003**: The 501 stub is completely removed — no code path through the endpoint can return HTTP 501
- **SC-004**: Invalid requests (missing `query` or `user_id`) are rejected with HTTP 400 without contacting kebi

## Clarifications

### Session 2026-03-31

- Q: Should the error response when kebi is unreachable use HTTP 502 or 503? → A: 503 — matches existing `AllExceptionsFilter` behaviour and `docs/api-contract.md`; no code change to the filter needed.

## Assumptions

- `user_id` in the request body is provided by the caller directly for now (no auth middleware injection yet, per task description)
- kebi's recall endpoint exists and conforms to the contract in `docs/api-contract.md`
- The HTTP client (`AiServiceClient` or equivalent) already exists and is configured with `ai_service.base_url` — this feature wires into existing infrastructure rather than building a new HTTP client
- Timeout for recall calls is 20 seconds per Constitution §VI (the project-wide HTTP client ceiling is 30s, but recall is specifically 20s)
