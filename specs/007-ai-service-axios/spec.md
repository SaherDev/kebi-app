# Feature Specification: AI Service Client — Migrate to Axios and Add extractPlace

**Feature Branch**: `001-ai-service-axios`
**Created**: 2026-03-25
**Status**: Draft
**Input**: User description: "Fix AiServiceClient to use NestJS HttpModule (Axios) per ADR-016. Add extractPlace() method to the interface and implementation."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Place Save Triggers Extraction via extractPlace (Priority: P1)

A developer working on the Places domain calls `extractPlace()` on the AI service client to forward a raw user input (text or URL) to kebi for parsing and saving. The method must be present on the interface and the implementation must forward the payload correctly and return a typed response.

**Why this priority**: Without `extractPlace()`, the Places domain cannot call the AI service at all. This is the primary reason for the feature and blocks all place-saving functionality.

**Independent Test**: Can be tested by calling `extractPlace()` with a valid payload in an integration test and verifying the correct HTTP request is made and a typed response is returned.

**Acceptance Scenarios**:

1. **Given** a valid `AiExtractPlacePayload` with `user_id` and `raw_input`, **When** `extractPlace()` is called, **Then** the AI service receives a POST request to `/v1/extract-place` with the payload as JSON, within the 10-second timeout.
2. **Given** the AI service returns a resolved response (`status: "resolved"`, `confidence >= 0.70`), **When** `extractPlace()` resolves, **Then** the caller receives a fully typed `AiExtractPlaceResponse` matching the api-contract.md schema.
3. **Given** the AI service returns an unresolved response (`status: "unresolved"`, `place_id: null`), **When** `extractPlace()` resolves, **Then** the caller receives the response with nullable fields (`place_id: null`, `place.place_name: null`) — no error is thrown.
4. **Given** the AI service does not respond within 10 seconds, **When** `extractPlace()` is called, **Then** the method rejects with a timeout error.

---

### User Story 2 — Existing consult and consultStream Work with Axios (Priority: P2)

After migrating from `node:http`/`node:https` to Axios, all existing functionality for `consult()` and `consultStream()` must continue to work without any change to route handlers or domain service callers.

**Why this priority**: The migration must not break existing functionality. `consult()` is the core recommendation flow. Any regression here breaks the primary product loop.

**Independent Test**: Existing unit and integration tests for `consult()` and `consultStream()` pass without modification after the migration.

**Acceptance Scenarios**:

1. **Given** the Axios-backed implementation is in place, **When** `consult()` is called with a valid payload, **Then** the AI service receives the same request as before and a typed `AiConsultResponse` is returned.
2. **Given** the Axios-backed implementation is in place, **When** `consultStream()` is called, **Then** an SSE-compatible stream is returned to the caller.
3. **Given** the module is registered in NestJS, **When** the application starts, **Then** no `node:http` or `node:https` imports exist in the `ai-service` module directory.

---

### User Story 3 — Type Contract Matches api-contract.md Exactly (Priority: P3)

All TypeScript types for the `extractPlace` payload and response must match the api-contract.md schema exactly, including nullable fields. No field names are guessed or inferred — they come directly from the contract.

**Why this priority**: Type safety at the boundary prevents runtime mismatches when kebi returns real responses. Incorrect field names or wrong nullability cause silent failures.

**Independent Test**: TypeScript compilation passes and a type-level test confirms that a raw api-contract.md JSON example can be assigned to `AiExtractPlaceResponse` without error.

**Acceptance Scenarios**:

1. **Given** the interface file defines `AiExtractPlacePayload`, **When** examined, **Then** it contains exactly two fields: `user_id: string` and `raw_input: string`.
2. **Given** the interface file defines `AiExtractPlaceResponse`, **When** examined, **Then** it contains: `place_id: string | null`, `place: { place_name: string | null, address: string | null, cuisine: string | null, price_range: string | null }`, `confidence: number`, `status: 'resolved' | 'unresolved'`, `requires_confirmation: boolean`, and `source_url: string | null`.
3. **Given** the TypeScript compiler runs, **When** the project builds, **Then** zero type errors are reported in the `ai-service` module.

---

### Edge Cases

- What happens when `extractPlace()` or `consult()` receives a non-2xx from the AI service? `AxiosError` propagates raw to callers — no wrapping. The `AllExceptionsFilter` (ADR-018) handles error translation in a subsequent task.
- What happens when `extractPlace()` receives an empty or malformed JSON response? The method must reject with a descriptive error.
- How does the system handle a missing `ai_service.base_url` config? The module must throw at startup, not silently at call time.
- What happens when `consultStream()` is called and Axios is used instead of `node:http`? The stream must still be pipe-compatible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `AiServiceModule` MUST register `HttpModule` from `@nestjs/axios` so that `HttpService` (Axios) is available for injection in `AiServiceClient`.
- **FR-002**: `AiServiceClient` MUST inject `HttpService` in its constructor and use it for all outbound HTTP calls — no `node:http` or `node:https` imports may remain. `AxiosError` propagates raw from all methods — no wrapping, no `normalizeError()` helper.
- **FR-003**: `AiServiceClient` MUST expose `extractPlace(payload: AiExtractPlacePayload): Promise<AiExtractPlaceResponse>` that calls `POST /v1/extract-place` with a 10-second timeout.
- **FR-004**: `IAiServiceClient` MUST declare `extractPlace(payload: AiExtractPlacePayload): Promise<AiExtractPlaceResponse>` so callers depend on the interface, not the concrete class.
- **FR-005**: `AiExtractPlacePayload` MUST have exactly `{ user_id: string; raw_input: string }` — no extra fields, no renamed fields.
- **FR-006**: `AiExtractPlaceResponse` MUST match api-contract.md: `place_id` (nullable string), `place` object with `place_name`, `address`, `cuisine`, `price_range` (all nullable strings), `confidence` (number), `status` (`'resolved' | 'unresolved'`), `requires_confirmation` (boolean), `source_url` (nullable string).
- **FR-007**: The existing `consult()` method MUST continue to function with a 20-second timeout per ADR-016 and Constitution Section VI. (Note: api-contract.md mentions "30s for all calls" as a general upper bound, but ADR-016 and the constitution explicitly set consult to 20s — ADRs take precedence.)
- **FR-008**: The existing `consultStream()` method MUST continue to return a stream that callers can pipe to an HTTP response.
- **FR-009**: No controller or domain service call site MUST change — the facade pattern (ADR-032, ADR-033) must be preserved end-to-end.
- **FR-010**: `pnpm nx test api` and `pnpm nx lint api` MUST both pass after the changes.

### Key Entities

- **AiExtractPlacePayload**: The request body sent from NestJS to kebi for place extraction. Two fields: user identity (`user_id`) and the raw unmodified input string (`raw_input`).
- **AiExtractPlaceResponse**: The typed response from kebi's extract-place endpoint. Contains the resolved or unresolved place record, confidence score, status, and whether user confirmation is required.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All existing API tests continue to pass after the migration — zero regressions.
- **SC-002**: The `ai-service` module directory contains zero imports of `node:http` or `node:https` after the change.
- **SC-003**: TypeScript compilation reports zero errors in the `ai-service` module.
- **SC-004**: `extractPlace()` enforces the 10-second timeout: a simulated slow AI service response taking longer than 10 seconds causes the method to reject.
- **SC-005**: `consult()` enforces the 20-second timeout per ADR-016 and Constitution Section VI.
- **SC-006**: The linter (`pnpm nx lint api`) reports zero errors or warnings in the changed files.

## Clarifications

### Session 2026-03-25

- Q: Should the Axios implementation normalize non-2xx errors into a plain `Error` (preserving the existing shape callers expect), or should `AxiosError` propagate raw? → A: Pass-through (Option B) — `AxiosError` propagates raw from all three methods. No `normalizeError()` helper. The `AllExceptionsFilter` (ADR-018) will handle `AxiosError` in a subsequent task.

## Assumptions

- `@nestjs/axios` is already installed or will be added to `services/api/package.json` as part of this task.
- The existing `consultStream()` behavior (returning a pipe-compatible stream) can be replicated with Axios using `responseType: 'stream'` — this is a standard Axios capability.
- `consultStream()` timeout is aligned to the same 20-second timeout as `consult()` per ADR-016 and Constitution Section VI.
- The `ConfigService` injection in the constructor does not change — only the HTTP transport changes.
- No new NestJS guards, filters, or interceptors are introduced in this task. Error normalization (ADR-018) is a separate concern.
