# Research: 009-recall-proxy

**Date**: 2026-03-31
**Branch**: `009-recall-proxy`

---

## Finding 1 — AiServiceClient Pattern (ADR-016)

**Decision**: Add `recall()` to `IAiServiceClient` interface + `AiServiceClient` concrete class, following the same pattern as `extractPlace()`.

**Rationale**:
- All AI forwarding goes through `IAiServiceClient` (ADR-016, ADR-033)
- `extractPlace()` is the closest analogue: single POST, synchronous JSON response, no streaming
- Timeout: api-contract.md + Constitution VI specify 20s for recall (same as consult)
- `AiServiceClient` uses `@nestjs/axios` `HttpService` + `firstValueFrom` — recall follows same pattern
- AxiosError propagation: let `AllExceptionsFilter` handle error mapping (no custom error handler needed in recall service)

**Alternatives considered**:
- Custom error handling in `RecallService` (like `ConsultService`) — rejected: adds complexity without benefit; `AllExceptionsFilter` already covers the 503 path correctly
- Inline HTTP call in service — rejected: violates ADR-016 and ADR-033

---

## Finding 2 — Error Mapping: 503 not 502

**Decision**: The recall proxy returns HTTP 503 when kebi is unreachable, not 502 as originally specified in spec.md.

**Rationale**:
- `AllExceptionsFilter` (ADR-018) already maps AxiosError without response → 503 `SERVICE_UNAVAILABLE`
- `docs/api-contract.md` explicitly states: "Timeout | Service unreachable → Return 503 with 'service temporarily unavailable'"
- Changing to 502 would require either forking `AllExceptionsFilter` or custom error handling in `RecallService`
- 503 is the correct and consistent choice across the API; spec.md was overly prescriptive about status code

**Impact on spec**: SC-002 should read "503" not "502" — functionally equivalent (both are clean, human-readable error responses). The user-facing requirement ("not a raw error") is fully met by 503.

---

## Finding 3 — user_id Source

**Decision**: Add `user_id` to `RecallRequestDto` and read it from the DTO body.

**Rationale**:
- Task description explicitly: "user_id comes from the request body for now"
- Existing controller already reads `req.user as ClerkUser` for auth-injected user_id — but this is not what the task asks for
- RecallRequestDto currently has only `query`; `user_id` must be added with `@IsString() @IsNotEmpty()`
- Controller passes `dto.user_id` directly to service (no `@CurrentUser()` decorator needed)

**Note**: Future work will switch to `@CurrentUser()` when auth middleware is wired for recall. This is intentional technical debt per the task spec.

---

## Finding 4 — RecallModule Must Import AiServiceModule

**Decision**: Add `AiServiceModule` to `RecallModule.imports` and inject `IAiServiceClient` via `AI_SERVICE_CLIENT` token in `RecallService`.

**Rationale**:
- Current `RecallModule` has no imports — this is why `RecallService` cannot use the AI client
- Pattern: `ConsultModule` imports `AiServiceModule` and exports `ConsultService`
- `RecallModule` does NOT need `RecommendationsModule` (no DB write for recall results per architecture rules)

---

## Finding 5 — Controller Updates

**Decision**: Remove `@HttpCode(501)` and default to 200 (NestJS default for POST). Pass `dto.user_id` from body.

**Rationale**:
- `@HttpCode(501)` explicitly overrides response code to 501 Not Implemented — must be removed
- Default NestJS POST response is 200 OK — correct for a successful recall
- No `@RequiresAi()` guard added (out of scope per task; future work)

---

## Finding 6 — RecallPlaceDto: saved_at Field

**Decision**: Add optional `saved_at?: string` to `RecallPlaceDto` to match api-contract.md response schema.

**Rationale**:
- `api-contract.md` defines `saved_at: ISO 8601 timestamp` as part of the recall place response
- Current `RecallPlaceDto` is missing this field
- All AI response fields must tolerate extra fields (Constitution §VI, `@IsOptional()` pattern)
- Adding `saved_at` now prevents a silent drop of data the frontend might use

---

## Finding 7 — Bruno Test File Location

**Decision**: Add `recall.bru` to `kebi-config/bruno/nestjs-api/` (not a new folder).

**Rationale**:
- Existing pattern: `consult-stream.bru` lives in `nestjs-api/`
- `places/extract-place.bru` lives in its own folder `places/` — but recall is an API endpoint, not a resource operation
- ADR-021: new endpoints require a `.bru` request file

---

## Finding 8 — Test File for RecallService

**Decision**: Create `services/api/src/recall/recall.service.spec.ts`.

**Rationale**:
- No spec file exists yet for `RecallService`
- Pattern from `consult.service.spec.ts`: mock `IAiServiceClient` + test forwarding and error paths
- `AiServiceClient.spec.ts` should also get a `recall()` method existence test (following existing pattern)
