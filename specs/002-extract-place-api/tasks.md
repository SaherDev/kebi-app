# Tasks: Place Extraction API Infrastructure

**Input**: Design documents from `/specs/002-extract-place-api/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. The feature implements a single endpoint (`POST /api/v1/places/extract`) that serves all three user stories through one cohesive module.

---

## Phase 1: Setup (Infrastructure)

**Purpose**: Initialize foundation for the extraction API

- [ ] T001 Remove `extractPlace()` stub from `services/api/src/app/app.controller.ts` (lines 40–50 containing `@Post('extract-place')` and `@RequiresAi()` decorator)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure MUST be complete before user story implementation

**⚠️ CRITICAL**: All user story work depends on completing this phase

- [ ] T002 Create `AllExceptionsFilter` at `services/api/src/common/filters/all-exceptions.filter.ts` implementing error mapping: 400→400, 422→422 "couldn't understand your request", 500→503 "service temporarily unavailable, please retry", timeout→503, other→500
- [ ] T003 Register `ValidationPipe` globally in `services/api/src/main.ts` with `{ whitelist: true, forbidNonWhitelisted: true, transform: true }` before `setGlobalPrefix()`
- [ ] T004 Register `AllExceptionsFilter` globally in `services/api/src/main.ts` via `app.useGlobalFilters(new AllExceptionsFilter())`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Submit Raw Place Data for Extraction (Priority: P1) 🎯 MVP

**Goal**: Enable users to submit raw place information and receive structured extraction results with metadata and confidence scores

**Independent Test**: Submit a valid request to `POST /api/v1/places/extract` with `raw_input` and verify a 200 response with place metadata, confidence, and status fields

### Implementation for User Story 1

- [ ] T005 [P] [US1] Create `ExtractPlaceRequestDto` at `services/api/src/places/dto/extract-place-request.dto.ts` with `@IsString()`, `@IsNotEmpty()`, `@MaxLength(10240)` decorators on `raw_input` field
- [ ] T006 [P] [US1] Create `PlacesService` at `services/api/src/places/places.service.ts` with one method `extractPlace(userId: string, dto: ExtractPlaceRequestDto)` that calls `aiClient.extractPlace()` without try/catch (let AxiosError propagate)
- [ ] T007 [P] [US1] Create `PlacesController` at `services/api/src/places/places.controller.ts` with `@Controller('places')` and `@Post('extract')` method calling `placesService.extractPlace(userId, dto)` decorated with `@RequiresAi()`
- [ ] T008 [US1] Create `PlacesModule` at `services/api/src/places/places.module.ts` importing `AiServiceModule`, registering controller and service
- [ ] T009 [US1] Register `PlacesModule` in `services/api/src/app/app.module.ts` imports array

**Checkpoint**: User Story 1 is fully functional. Verify: `pnpm nx build api` succeeds, route exists at `POST /api/v1/places/extract`

---

## Phase 4: User Story 2 — Prevent Invalid Requests from Reaching Business Logic (Priority: P2)

**Goal**: Reject malformed requests before they reach the service, providing clear validation error messages

**Independent Test**: Send request to `POST /api/v1/places/extract` without `raw_input` field and verify 400 Bad Request with validation error message

### Verification for User Story 2

The validation layer is implemented via the `ExtractPlaceRequestDto` created in T005 + global `ValidationPipe` registered in T003. Both are already in place.

- [ ] T010 [US2] Verify validation: Send request without `raw_input` field to `POST /api/v1/places/extract`, confirm 400 Bad Request response
- [ ] T011 [US2] Verify whitelist: Send request with extra field (e.g., `{"raw_input": "...", "extra": "field"}`) to `POST /api/v1/places/extract`, confirm field is stripped and request succeeds
- [ ] T012 [US2] Verify max size: Send request with `raw_input` > 10240 chars to `POST /api/v1/places/extract`, confirm 400 Bad Request with size validation message

**Checkpoint**: Validation works independently. User Story 2 requirements met.

---

## Phase 5: User Story 3 — Handle Service Failures Gracefully (Priority: P2)

**Goal**: Return meaningful error responses when the AI service is unavailable, times out, or fails, preventing crashes and helping clients distinguish client errors from server errors

**Independent Test**: Mock the AI service to return 500 or timeout, verify `POST /api/v1/places/extract` returns 503 with "service temporarily unavailable, please retry" message

### Verification for User Story 3

The error handling layer is implemented via the `AllExceptionsFilter` created in T002 + registration in T004. Both are already in place.

- [ ] T013 [US3] Verify 400 handling: Mock AI service to return 400, confirm filter passes through 400 to client
- [ ] T014 [US3] Verify 422 handling: Mock AI service to return 422, confirm filter responds 422 with "couldn't understand your request" message
- [ ] T015 [US3] Verify 500→503 mapping: Mock AI service to return 500, confirm filter responds 503 with "service temporarily unavailable, please retry" message
- [ ] T016 [US3] Verify timeout handling: Mock AI service to timeout (no response), confirm filter responds 503 with "service temporarily unavailable, please retry" message

**Checkpoint**: Error handling works independently. User Story 3 requirements met.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final integration, testing, and documentation

- [ ] T017 [P] Create Bruno request file at `kebi-config/bruno/places/extract-place.bru` with test scenarios for happy path and error cases
- [ ] T018 Run tests: `pnpm nx test api` — verify all existing tests pass
- [ ] T019 Run linter: `pnpm nx lint api` — verify no lint errors introduced
- [ ] T020 Run build: `pnpm nx build api` — verify TypeScript compiles cleanly
- [ ] T021 Verify route exists: Start API `pnpm nx serve api`, confirm `POST /api/v1/places/extract` responds with expected schema

**Checkpoint**: Feature complete, tested, and ready for integration

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 completion — **BLOCKS all user stories**
- **Phase 3 (US1)**: Depends on Phase 2 completion — MVP slice
- **Phase 4 (US2)**: Depends on Phase 2 completion — can start after Foundational, runs in parallel with US1 verification or after US1
- **Phase 5 (US3)**: Depends on Phase 2 completion — can start after Foundational, runs in parallel with US2 verification or after US2
- **Phase 6 (Polish)**: Depends on all desired user stories being complete

### Parallel Opportunities

**Within Foundational (Phase 2):**
- Cannot parallelize — T002 must complete before T003 and T004 (filter before registration)

**Within User Story 1 (Phase 3):**
- T005, T006, T007 can run in parallel (different files, no dependencies until T008)
- T008 depends on T005, T006, T007
- T009 depends on T008

**Across User Stories (after Foundational):**
- User Stories 2 and 3 are verification-only and can run in parallel with each other or sequentially
- They don't add new code, just validate existing implementations (filter + pipe from Foundational)

### Sequence Recommendation

**MVP-First Approach (fastest path to validate core functionality):**
1. Complete Phase 1 (Setup) — 1 task
2. Complete Phase 2 (Foundational) — 3 tasks [BLOCKS everything]
3. Complete Phase 3 (User Story 1) — 5 tasks [This is the MVP: core extraction endpoint]
4. **STOP and VALIDATE** — Test US1 independently: submit place data, receive result
5. Complete Phase 4 (US2 Verification) — 3 tasks [Validate input handling]
6. Complete Phase 5 (US3 Verification) — 4 tasks [Validate error handling]
7. Complete Phase 6 (Polish) — 5 tasks [Final integration and testing]

---

## Implementation Strategy

### MVP First (User Story 1 Only)

**Total tasks**: T001–T009 (9 tasks)
**Time estimate**: ~2–3 hours
**Deliverable**: Functional `POST /api/v1/places/extract` endpoint with full request→AI service→response flow

1. ✅ Phase 1: Remove stub (T001)
2. ✅ Phase 2: Foundation (T002–T004) — **Must complete before proceeding**
3. ✅ Phase 3: US1 Implementation (T005–T009) — Core feature
4. 🔄 Phase 6: Smoke test (pnpm nx build api, pnpm nx test api)

**At this point**: User Story 1 is complete and independently testable. Deploy if ready.

### Incremental Delivery (All User Stories)

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → MVP ready
3. Add User Story 2 verification → Validation works
4. Add User Story 3 verification → Error handling works
5. Polish → Production ready

**Each story adds value without breaking previous stories.**

---

## Notes

- [P] = tasks in parallel (different files, no dependencies)
- [Story] = task belongs to specific user story for traceability
- Each user story is independently completable and testable
- All DTO validation happens via global `ValidationPipe` (T003) + `ExtractPlaceRequestDto` (T005)
- All error mapping happens via global `AllExceptionsFilter` (T002, T004)
- Service makes no assumptions about errors — propagates `AxiosError` raw to filter
- Controller is pure facade — one service call, no logic
- Verify at each checkpoint before moving forward
- Tests in Phases 4–5 are verification tasks (not new implementation) — they validate existing components from Foundational phase
