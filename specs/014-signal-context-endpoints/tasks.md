# Tasks: Signal & User Context Gateway Endpoints

**Input**: Design documents from `/specs/014-signal-context-endpoints/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included (per research R9). Unit tests for every new AiServiceClient method, service, and controller; Bruno files cover integration surface. No new Supertest/e2e infrastructure.

**Organization**: Grouped by user story (P1 → P2 → P3). Each story is independently testable and deliverable.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel — different files, no dependency on incomplete tasks
- **[Story]**: User-story traceability (US1, US2, US3)
- File paths are absolute from repo root

## Path Conventions

- NestJS backend: `services/api/src/...`
- Shared types: `libs/shared/src/lib/types.ts`
- Bruno API tests: `kebi-config/bruno/nestjs-api/...`
- Feature docs: `specs/014-signal-context-endpoints/...`

---

## Phase 1: Setup

**Purpose**: Confirm repo state before any edits.

- [X] T001 Confirm current branch is `014-signal-context-endpoints` and working tree is clean (`git status`)
- [X] T002 Smoke check that `services/api/src/signal/` and `services/api/src/user-context/` do not exist yet (`ls services/api/src | grep -E '^(signal|user-context)$'` returns nothing)
- [X] T003 Baseline verification: `pnpm nx build api` passes on the clean branch before any edits

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared scaffolding that must exist before any user story code compiles.

**Note**: This feature has no true cross-story foundational work — each story adds its own types and interface methods independently. The only hard prerequisite is a baseline build, captured in T003. No other foundational tasks are required.

**Checkpoint**: Foundation ready → all user stories can now proceed (in parallel if staffed).

---

## Phase 3: User Story 1 — Consult response carries `recommendation_id` (Priority: P1) 🎯 MVP

**Goal**: Every consult response includes a stable `recommendation_id` so US2 and US3 can reference recommendations by ID.

**Independent Test**: Send a consult-intent message via `POST /api/v1/chat`. Verify the JSON response contains `data.recommendation_id` (string or null) — per Quickstart step 1.

**Why this is the MVP**: No NestJS code change beyond a type widening. Deliverable in one commit. Unlocks US2.

### Implementation for User Story 1

- [X] T004 [US1] Extend `ConsultResponseData` in `/Users/saher/dev/repos/kebi-dev/kebi-app/libs/shared/src/lib/types.ts` by adding `recommendation_id: string | null` as the first field of the interface (see data-model.md §1)
- [X] T005 [US1] Verify shared lib builds: `pnpm nx build shared`
- [X] T006 [US1] Verify API still builds against widened type: `pnpm nx build api`

### Verification for User Story 1

- [ ] T007 [US1] Manual verification via Quickstart step 1 — send consult message through Bruno, confirm `data.recommendation_id` key is present in response (value may be any string or null) — **deferred to human QA; requires running FastAPI with matching contract**

**Checkpoint**: US1 complete — the consult type contract now carries `recommendation_id`. US2 can begin immediately.

---

## Phase 4: User Story 2 — `POST /api/v1/signal` (Priority: P2)

**Goal**: Frontend can post `recommendation_accepted` / `recommendation_rejected` signals and have them forwarded to FastAPI; 202 on success, 404 on unknown recommendation_id.

**Independent Test**: Quickstart steps 2–6 — accepted signal returns 202, rejected signal returns 202, bogus recommendation_id returns 404, malformed body returns 400, unknown signal_type returns 400.

### Shared Types for User Story 2

- [X] T008 [P] [US2] Add to `/Users/saher/dev/repos/kebi-dev/kebi-app/libs/shared/src/lib/types.ts`: `SignalType`, `SignalRequestAccepted`, `SignalRequestRejected`, `SignalRequest` (discriminated union), `SignalRequestWithUser` (intersection with `{ user_id: string }`), `SignalResponse` — shapes per data-model.md §3 and §4
- [X] T009 [US2] Verify `libs/shared` builds with new types: `pnpm nx build shared`

### AiServiceClient Extension for User Story 2

- [X] T010 [P] [US2] Extend `IAiServiceClient` in `/Users/saher/dev/repos/kebi-dev/kebi-app/services/api/src/ai-service/ai-service-client.interface.ts` — add `postSignal(payload: SignalRequestWithUser): Promise<SignalResponse>` with JSDoc pointing to ADR-033 and ADR-036 (see contracts/ai-service-client.ts)
- [X] T011 [US2] Implement `postSignal` in `/Users/saher/dev/repos/kebi-dev/kebi-app/services/api/src/ai-service/ai-service.client.ts` — POST `${baseUrl}/v1/signal`, 30 s timeout, lets AxiosError propagate raw per ADR-036 pattern
- [X] T012 [P] [US2] Add unit tests in `/Users/saher/dev/repos/kebi-dev/kebi-app/services/api/src/ai-service/ai-service.client.spec.ts` for `postSignal` — happy path (202 + body) and raw upstream-error propagation; also fixed a pre-existing bug: the old spec constructed `AiServiceClient` with only one arg but the constructor takes two (configService + httpService)

### Signal Module Implementation for User Story 2

- [X] T013 [P] [US2] Create request DTO at `/Users/saher/dev/repos/kebi-dev/kebi-app/services/api/src/signal/dto/signal-request.dto.ts` — class `SignalRequestDto` with `@IsIn(['recommendation_accepted', 'recommendation_rejected'])` on `signal_type`, `@IsString() @IsNotEmpty()` on `recommendation_id` and `place_id`
- [X] ~~T014 [P] [US2] Create response DTO~~ — **skipped**; the `@Serialize()` decorator referenced by ADR-023 is not implemented in this repo (verified via `grep`) and no existing controller uses it. Following the chat module pattern, service returns the shared `SignalResponse` type directly. Noted in US2 checkpoint notes.
- [X] T015 [US2] Implement `SignalService` at `/Users/saher/dev/repos/kebi-dev/kebi-app/services/api/src/signal/signal.service.ts` — injects `IAiServiceClient` via `@Inject(AI_SERVICE_CLIENT)`, exposes `submit(userId, dto)` → `Promise<SignalResponse>`, builds `SignalRequestWithUser` and forwards
- [X] T016 [US2] Implement `SignalController` at `/Users/saher/dev/repos/kebi-dev/kebi-app/services/api/src/signal/signal.controller.ts` — `@Controller('signal')`, `@Post()`, `@HttpCode(HttpStatus.ACCEPTED)`, `@RequiresAi()`; body is exactly one line calling `signalService.submit(userId, dto)` (ADR-032 facade rule)
- [X] T017 [US2] Create `SignalModule` at `/Users/saher/dev/repos/kebi-dev/kebi-app/services/api/src/signal/signal.module.ts` — imports `AiServiceModule`, declares `SignalController` + `SignalService`
- [X] T018 [US2] Register `SignalModule` in `/Users/saher/dev/repos/kebi-dev/kebi-app/services/api/src/app/app.module.ts` `imports` array

### Tests for User Story 2

- [X] T019 [P] [US2] Unit-test `SignalService` at `/Users/saher/dev/repos/kebi-dev/kebi-app/services/api/src/signal/signal.service.spec.ts` — mocked `IAiServiceClient`; asserts user_id injection, rejected-variant forwarding, and raw error propagation
- [X] T020 [P] [US2] Unit-test `SignalController` at `/Users/saher/dev/repos/kebi-dev/kebi-app/services/api/src/signal/signal.controller.spec.ts` — mocked `SignalService`; asserts facade-only rule (exactly one service call, return value forwarded unchanged)

### Bruno & Verification for User Story 2

- [X] T021 [US2] Add Bruno file at `/Users/saher/dev/repos/kebi-dev/kebi-app/kebi-config/bruno/nestjs-api/signal.bru` with three requests: `Signal — Accepted`, `Signal — Rejected`, `Signal — Bogus Recommendation ID` (for 404 path)
- [ ] T022 [US2] Run Quickstart steps 2–6 against local dev — **deferred to human QA; requires running FastAPI with matching contract**
- [X] T023 [US2] Regression gate: `pnpm nx test api` passes (40/40); no lint errors from new files (`pnpm nx lint api`)

**Checkpoint**: US1 + US2 complete — end-to-end feedback loop works (consult → recommendation_id → accept/reject signal). Can deploy this increment.

---

## Phase 5: User Story 3 — `GET /api/v1/user/context` (Priority: P3)

**Goal**: Authenticated caller can read a taste summary `{ saved_places_count, chips[] }` for their own user.

**Independent Test**: Quickstart step 7 — GET returns valid JSON for both populated and cold-start users; step 8 auth-failure cases return 401/403.

### Shared Types for User Story 3

- [X] T024 [P] [US3] Add to `/Users/saher/dev/repos/kebi-dev/kebi-app/libs/shared/src/lib/types.ts`: `UserContextChip`, `UserContextResponse` — shapes per data-model.md §2 (added together with US2 types in one edit)
- [X] T025 [US3] Verify `libs/shared` builds: `pnpm nx build shared`

### AiServiceClient Extension for User Story 3

- [X] T026 [P] [US3] Extend `IAiServiceClient` in `/Users/saher/dev/repos/kebi-dev/kebi-app/services/api/src/ai-service/ai-service-client.interface.ts` — added `getUserContext(userId: string): Promise<UserContextResponse>`
- [X] T027 [US3] Implement `getUserContext` in `/Users/saher/dev/repos/kebi-dev/kebi-app/services/api/src/ai-service/ai-service.client.ts` — GET `${baseUrl}/v1/user/context` with `params: { user_id }`, 30 s timeout
- [X] T028 [P] [US3] Unit tests in `ai-service.client.spec.ts` for `getUserContext` — populated response, cold-start response

### User Context Module Implementation for User Story 3

- [X] ~~T029 [P] [US3] Create response DTO~~ — **skipped for the same reason as T014**: `@Serialize()` pattern is not implemented in repo. Service returns the shared `UserContextResponse` type directly.
- [X] T030 [US3] Implement `UserContextService` at `/Users/saher/dev/repos/kebi-dev/kebi-app/services/api/src/user-context/user-context.service.ts` — injects `IAiServiceClient`, returns `Promise<UserContextResponse>`
- [X] T031 [US3] Implement `UserContextController` at `/Users/saher/dev/repos/kebi-dev/kebi-app/services/api/src/user-context/user-context.controller.ts` — `@Controller('user/context')`, `@Get()`, `@RequiresAi()`; body is one line calling `userContextService.get(userId)`
- [X] T032 [US3] Create `UserContextModule` at `/Users/saher/dev/repos/kebi-dev/kebi-app/services/api/src/user-context/user-context.module.ts`
- [X] T033 [US3] Register `UserContextModule` in `/Users/saher/dev/repos/kebi-dev/kebi-app/services/api/src/app/app.module.ts`

### Tests for User Story 3

- [X] T034 [P] [US3] Unit-test `UserContextService` — mocked `IAiServiceClient`; asserts user_id forwarding and passthrough of both populated and cold-start responses
- [X] T035 [P] [US3] Unit-test `UserContextController` — mocked `UserContextService`; asserts facade-only rule

### Bruno & Verification for User Story 3

- [X] T036 [US3] Added Bruno file at `/Users/saher/dev/repos/kebi-dev/kebi-app/kebi-config/bruno/nestjs-api/user-context.bru` with expected-response examples for both populated and cold-start states
- [ ] T037 [US3] Run Quickstart steps 7–8 against local dev — **deferred to human QA; requires running FastAPI with matching contract**
- [X] T038 [US3] Regression gate: `pnpm nx test api` passes (40/40); no lint errors from new files

**Checkpoint**: All three stories complete. Full feature delivered.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T039 [P] Cleaned up misleading JSDoc example in `/Users/saher/dev/repos/kebi-dev/kebi-app/services/api/src/common/decorators/requires-ai.decorator.ts` — replaced the `recommendationService.consult()` reference with a `/signal` example
- [X] T040 Full-suite gate: `pnpm nx run-many -t test,lint,build -p api,shared` passes — 40/40 tests, clean lint (0 errors in new files), build green
- [X] T041 Quickstart step 10 executed — `grep "InsertResult|TypeOrmModule.forFeature|.save("` returns zero matches in `services/api/src/signal` and `services/api/src/user-context` (SC-005)
- [X] T042 Final Constitution re-read — §I two-repo boundary preserved (zero LLM/embedding/vector/Places calls); §II Nx boundaries clean (only `libs/shared` imported); §V no DB writes in new modules (T041 verified); §VI interface-first + 30 s timeout reused; §IX Bruno files added for both endpoints; §X `nestjs-expert` invoked pre-plan
- [X] T043 FR traceability: see mapping block below — every FR-001…FR-022 ties to an implemented artefact

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2, empty)** → **User Stories (Phase 3, 4, 5)** → **Polish (Phase 6)**
- **US1 ↔ US2**: US2 conceptually depends on US1 (US2 is about posting signals referencing the ID US1 exposes), but in code the two do not share an edit surface — they can be implemented in parallel. US2's Quickstart verification (T022) benefits from US1 being live in FastAPI first, but the gateway code compiles independently.
- **US2 ↔ US3**: fully independent code paths and file sets.
- **Polish** depends on all three user-story phases being complete.

### Within each user story

- Shared types (libs/shared) → Interface extension → Client implementation → DTOs → Service → Controller → Module → AppModule registration → Tests → Bruno → Verification.
- Unit tests of client methods depend on the implementation being in place; unit tests of services/controllers can be written alongside implementation (same file discipline — write the test after the implementation is settled).

### Parallel opportunities

- **Across stories**: After T003 completes, US1 (T004–T007), US2 (T008–T023), and US3 (T024–T038) can all run in parallel on separate branches/worktrees.
- **Within US2**: T008, T010, T013, T014 all touch different files — fully parallel.
- **Within US3**: T024, T026, T029 all touch different files — fully parallel.
- **Unit tests** marked [P] across the feature can be authored in parallel once their subject files land.

---

## Parallel Example: User Story 2

```bash
# After T003 baseline build passes, launch these four in parallel:
Task: "T008 Add SignalType/SignalRequest/SignalResponse types to libs/shared/src/lib/types.ts"
Task: "T010 Extend IAiServiceClient with postSignal in services/api/src/ai-service/ai-service-client.interface.ts"
Task: "T013 Create SignalRequestDto in services/api/src/signal/dto/signal-request.dto.ts"
Task: "T014 Create SignalResponseDto in services/api/src/signal/dto/signal-response.dto.ts"

# Then sequentially:
# T011 AiServiceClient.postSignal implementation (needs T008 + T010)
# T015 SignalService (needs T008, T010, T013, T014)
# T016 SignalController (needs T014, T015)
# T017 SignalModule (needs T015, T016)
# T018 Register in app.module.ts (needs T017)

# Test pair can run in parallel after T015 and T016 land:
Task: "T019 Unit-test SignalService"
Task: "T020 Unit-test SignalController"
```

---

## Implementation Strategy

### MVP scope (User Story 1 only)

1. Phase 1 Setup (T001–T003)
2. Phase 3 US1 (T004–T007) — one-line type widening + build verification
3. **Stop, ship** if the FastAPI side of `recommendation_id` isn't ready yet — US1 by itself is safe: the frontend still reads `data.recommendation_id` as optional.

### Incremental delivery

1. Setup + US1 → ship type widening
2. Add US2 → ship signal endpoint (unlocks feedback loop)
3. Add US3 → ship user-context endpoint (transparency surface)
4. Polish

### Parallel team strategy

Stories are fully independent at the file level. With three developers:

- Dev A: US1 + Polish
- Dev B: US2 (has more tasks; starts with parallel sub-tasks T008/T010/T013/T014)
- Dev C: US3 (starts with parallel sub-tasks T024/T026/T029)

All converge in `app.module.ts` — resolve merge conflict by additive import (two new lines in the `imports` array).

---

## Notes

- **No Prisma/TypeORM schema changes** in this feature. Zero entity files, zero migrations (SC-005 / research R7).
- **No filter edits**: `AllExceptionsFilter` already passes upstream 404 through (research R1). The spec originally said "extend the filter" — corrected during planning; tasks do not include a filter change.
- **Every new endpoint has a Bruno file** — Constitution §IX / ADR-021 gate enforced by T021 and T036.
- **Traceability**: the PR description should map each FR-xxx from spec.md to a task ID above (T043).
- **Commit discipline**: `feat(shared): …` for libs/shared edits, `feat(api): …` for services/api work. One logical commit per task group where possible.

---

## FR traceability (T043)

| FR | Artefact |
|----|----------|
| FR-001 | `ConsultResponseData.recommendation_id: string \| null` in `libs/shared/src/lib/types.ts` |
| FR-002 | Zero transformation in `ChatService` / `AiServiceClient.chat()` — field flows through verbatim |
| FR-003 | Same `libs/shared` edit; consumed by both api and web |
| FR-004 | `SignalController` uses `@RequiresAi()`; Clerk via global `ClerkMiddleware` |
| FR-005 | `@IsIn(ALLOWED_SIGNAL_TYPES)` on `SignalRequestDto.signal_type` |
| FR-006 | `@IsString() @IsNotEmpty()` on `recommendation_id` and `place_id` |
| FR-007 | `SignalService.submit()` injects `user_id` from Clerk-derived `userId` argument; `SignalRequestDto` has no `user_id` field so `forbidNonWhitelisted` rejects any attempt to spoof it |
| FR-008 | `SignalService` calls `IAiServiceClient.postSignal()`; no `axios`/`fetch` imports outside `AiServiceClient` |
| FR-009 | `@HttpCode(HttpStatus.ACCEPTED)` on the controller method; body is the upstream `SignalResponse` pass-through |
| FR-010 | Existing `AllExceptionsFilter` pass-through branch at `all-exceptions.filter.ts:51` handles 404 → 404 (research R1 — no edit needed) |
| FR-011 | `SignalController.submit()` body is one line (`return this.signalService.submit(userId, dto)`); asserted by `signal.controller.spec.ts` |
| FR-012 | `UserContextController` uses `@RequiresAi()`; Clerk via global middleware |
| FR-013 | `@Get()` handler takes only `@CurrentUser() userId`; no `@Body()` |
| FR-014 | `AiServiceClient.getUserContext()` uses `params: { user_id: userId }` → serialised as `?user_id=…` |
| FR-015 | `UserContextResponse` type has exactly `saved_places_count: number` and `chips: UserContextChip[]` |
| FR-016 | `UserContextResponse` + `UserContextChip` exported from `@kebi-app/shared` |
| FR-017 | `UserContextController.get()` body is one line; asserted by `user-context.controller.spec.ts` |
| FR-018 | Cold-start pass-through verified in `user-context.service.spec.ts` "passes through a cold-start response" and `ai-service.client.spec.ts` "passes through a cold-start response unchanged" |
| FR-019 | `services/api/src/signal` and `services/api/src/user-context` contain no `TypeOrmModule.forFeature`, no `.save(`, no new entities (T041 grep is zero) |
| FR-020 | `SignalService` and `UserContextService` each import `IAiServiceClient` only; no HTTP library imports |
| FR-021 | `kebi-config/bruno/nestjs-api/signal.bru` and `user-context.bru` both created |
| FR-022 | `IAiServiceClient` now has `postSignal` + `getUserContext` methods |
