# Tasks: Wire Recall Proxy to kebi

**Feature**: 009-recall-proxy
**Branch**: `009-recall-proxy`
**Created**: 2026-03-31
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Implementation Strategy

**MVP scope**: User Story 1 (P1) — Successful recall query forwarding.

**Incremental delivery approach**:
1. Implement AI service client interface and method (`recall()`)
2. Wire RecallService to forward requests
3. Update DTOs and controller
4. Test forwarding with kebi running
5. Add error handling (User Story 2)
6. Add validation (User Story 3)
7. Create Bruno test file for manual API testing

**Parallel opportunities**:
- T002–T004: DTO updates can be done in parallel (no dependencies)
- T006–T007: RecallService implementation and controller updates are independent of each other until integration

---

## Task Checklist

### Phase 1: Setup & Foundational

These tasks set up the infrastructure that both the client and service depend on.

- [x] T001 Import `AiServiceModule` in `services/api/src/recall/recall.module.ts` to enable dependency injection

---

### Phase 2: User Story 1 — Successful Recall Query (P1)

**Goal**: Forward valid recall requests to kebi and return the response as-is.

**Independent Test Criteria**:
- Send `POST /api/v1/recall` with body `{ "query": "that ramen place I saved from TikTok", "user_id": "user_123" }`
- Verify NestJS forwards to `POST http://localhost:8000/v1/recall` with the same body
- Verify the response from kebi is returned to the caller with HTTP 200

**Acceptance Scenarios** (from spec.md):
1. Valid request body forwarded to kebi with same structure
2. Exact response returned with HTTP 200
3. Empty results array `{ "results": [], "total": 0 }` handled correctly

#### DTO & Interface Tasks

- [x] T002 [P] [US1] Add `AiRecallPayload`, `AiRecallPlace`, `AiRecallResponse` interfaces to `services/api/src/ai-service/ai-service-client.interface.ts`
- [x] T003 [P] [US1] Add `user_id: string` field with validators to `services/api/src/recall/dto/recall-request.dto.ts`
- [x] T004 [P] [US1] Add optional `saved_at?: string` field to `services/api/src/recall/dto/recall-place.dto.ts`

#### AI Service Client Tasks

- [x] T005 [US1] Implement `recall(payload: AiRecallPayload): Promise<AiRecallResponse>` method in `services/api/src/ai-service/ai-service.client.ts` with 20-second timeout
- [x] T006 [US1] Add `recall()` method signature to `IAiServiceClient` interface in `services/api/src/ai-service/ai-service-client.interface.ts`

#### Service & Controller Tasks

- [x] T007 [P] [US1] Replace `NotImplementedException` stub with forwarding logic in `services/api/src/recall/recall.service.ts`:
  - Accept `RecallRequestDto` with `user_id` and `query`
  - Inject `IAiServiceClient` via `AI_SERVICE_CLIENT` token
  - Call `aiClient.recall({ user_id, query })`
  - Return response directly (no transformation)

- [x] T008 [P] [US1] Update `services/api/src/recall/recall.controller.ts`:
  - Remove `@HttpCode(501)` decorator
  - Remove `@Request()` parameter and `req.user` access
  - Pass `dto` directly to service (not split `userId + dto`)
  - No `@RequiresAi()` guard (out of scope)

#### Testing Tasks

- [x] T009 [US1] Add `recall()` method existence test to `services/api/src/ai-service/ai-service.client.spec.ts`

- [x] T010 [US1] Create unit tests for `services/api/src/recall/recall.service.spec.ts`:
  - Mock `IAiServiceClient`
  - Test forwarding: payload sent with `user_id` and `query`
  - Test response passthrough: response returned unchanged
  - Test error propagation: AxiosError throws for test framework

---

### Phase 3: User Story 2 — kebi Unreachable (P2)

**Goal**: Return HTTP 503 with readable message when kebi is unreachable or returns 5xx.

**Independent Test Criteria**:
- Point `ai_service.base_url` to invalid host
- Send `POST /api/v1/recall` with valid body
- Verify response is HTTP 503 with `{ "statusCode": 503, "message": "service temporarily unavailable, please retry" }`

**Acceptance Scenarios** (from spec.md):
1. Connection refused/timeout → 503 with readable message
2. kebi returns HTTP 500 → 503 with readable message
3. Network timeout → 503 with readable message

#### Implementation Tasks

- [ ] T011 [US2] Verify `AllExceptionsFilter` in `services/api/src/common/filters/all-exceptions.filter.ts` maps AxiosError → HTTP 503:
  - No custom handling needed in `RecallService` (delegate to filter)
  - Filter already handles timeouts and 5xx responses
  - Confirm pass-through for 400/422 (separate from US2 scope)

- [ ] T012 [US2] Add error-scenario tests to `services/api/src/recall/recall.service.spec.ts`:
  - Mock `aiClient.recall()` to throw AxiosError (timeout)
  - Test that error propagates (service doesn't catch it)
  - Verify controller lets `AllExceptionsFilter` handle it

---

### Phase 4: User Story 3 — Invalid Request Body (P3)

**Goal**: Reject requests missing `query` or `user_id` with HTTP 400 before forwarding.

**Independent Test Criteria**:
- Send `POST /api/v1/recall` with empty body
- Verify HTTP 400 returned with validation error message
- Verify kebi is NOT called

**Acceptance Scenarios** (from spec.md):
1. Missing `query` field → 400
2. Empty string `query` → 400
3. Missing `user_id` field → 400 (implied by FR-004)

#### Implementation Tasks

- [ ] T013 [US3] Confirm `RecallRequestDto` validation decorators in `services/api/src/recall/dto/recall-request.dto.ts`:
  - `@IsString() @IsNotEmpty() query: string` ✓ (already present)
  - `@IsString() @IsNotEmpty() user_id: string` ✓ (added in T003)
  - Global `ValidationPipe` (ADR-017) rejects invalid payloads before service is called

- [ ] T014 [US3] Add validation tests to `services/api/src/recall/recall.service.spec.ts`:
  - Missing `query` → 400 (handled by NestJS, not service)
  - Missing `user_id` → 400
  - Empty string → 400

- [ ] T015 [US3] Manual test via Bruno: Send invalid payloads, confirm 400 responses without calling kebi in `/Users/saher/dev/repos/kebi-dev/kebi-config/bruno/nestjs-api/recall.bru`

---

### Phase 5: Polish & Testing

**Goal**: Create manual API test file and verify end-to-end behavior.

#### Bruno API Test File

- [x] T016 Create `recall.bru` in `/Users/saher/dev/repos/kebi-dev/kebi-config/bruno/nestjs-api/`:
  - Happy path: Valid recall query with user_id → 200
  - Error: Missing query → 400
  - Error: Missing user_id → 400
  - Error scenario (commented): AI service down → 503

#### Verification

- [x] T017 Run verification commands:
  - `pnpm nx test api` — all unit tests pass ✓ 35 tests passed
  - `pnpm nx lint api` — no lint errors ✓ (warnings only in pre-existing unrelated code)
  - `pnpm nx build api` — clean build with no errors ✓ compiled successfully

- [ ] T018 Manual smoke test (requires kebi running at `localhost:8000`):
  ```bash
  curl -X POST http://localhost:3333/api/v1/recall \
    -H "Content-Type: application/json" \
    -d '{"query": "that ramen place", "user_id": "test-user"}'
  ```
  Confirm HTTP 200 with `{ "results": [...], "total": N }`

- [x] T019 Verify 501 stub is completely removed:
  - No `@HttpCode(501)` in `recall.controller.ts` ✓
  - No `NotImplementedException` in `recall.service.ts` ✓
  - No code path returns HTTP 501 ✓

---

## Task Dependencies

**Critical path** (in order):
1. T001 (Setup: import module)
2. T002–T004 (DTOs & interfaces — can parallelize)
3. T005–T006 (AI service client)
4. T007–T008 (Service & controller — can parallelize)
5. T009–T010 (Tests for US1)
6. T011–T012 (Error handling for US2)
7. T013–T015 (Validation for US3)
8. T016–T019 (Polish & verification)

**Parallelization opportunities**:
- **After T001**: T002, T003, T004 can run in parallel (different files)
- **After T005–T006**: T007 and T008 can run in parallel (service and controller)
- **After T008**: T009–T010 can run in parallel (different test files)

**Blocking dependencies**:
- T007 depends on T005–T006 (client must exist before service uses it)
- T008 depends on T003–T004 (DTOs must be correct before controller uses them)
- T011–T012 depend on T007 (error handling tested after service implemented)

---

## Completion Criteria

| Success Metric | How to Verify | Status |
|---|---|---|
| SC-001: Valid request forwarded unchanged | T010: unit test + T018: manual test | Implementation |
| SC-002: 503 on service unreachable | T012: error test + manual with invalid URL | Implementation |
| SC-003: 501 stub removed | T019: verification task | Implementation |
| SC-004: Invalid requests rejected with 400 | T014–T015: validation tests | Implementation |

---

## Task Count Summary

| Phase | Tasks | User Story | Count |
|---|---|---|---|
| Phase 1 | T001 | Setup | 1 |
| Phase 2 | T002–T010 | US1 (P1) | 9 |
| Phase 3 | T011–T012 | US2 (P2) | 2 |
| Phase 4 | T013–T015 | US3 (P3) | 3 |
| Phase 5 | T016–T019 | Polish | 4 |
| **Total** | T001–T019 | — | **19** |

---

## Notes

- **No database changes required** — recall is a pure proxy; no schema changes
- **No auth middleware added** — `user_id` from request body (per task spec)
- **Future work**: `@RequiresAi()` guard and `user_id` from Clerk auth (ADR-022)
- **Tests are optional but recommended** — this task list includes unit + manual tests for completeness; core implementation is T001–T008
