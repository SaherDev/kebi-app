# Tasks: Consult SSE Proxy

**Feature**: 001-consult-sse-proxy
**Branch**: `001-consult-sse-proxy`
**Date**: 2026-03-17
**Status**: Ready for implementation

**Input**: Design documents from `specs/001-consult-sse-proxy/`
**Prerequisites**: plan.md ✓, spec.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

---

## Phase 1: Setup — Shared Types (Blocking Prerequisite)

**Purpose**: Define shared TypeScript types in `libs/shared` so both `apps/web` and `services/api` use the same contracts. These types are the single source of truth for request/response shapes across the entire application.

**⚠️ CRITICAL**: This phase MUST complete before any service implementation begins. It blocks all user stories.

- [ ] T001 Add shared types to `libs/shared/src/lib/types.ts`: `LocationCoordinates` (lat/lng), `PlaceResult` (place_name, address, reasoning, source), `ReasoningStep` (step, summary), `ConsultRequest` (query, location?, stream?), `ConsultResponse` (primary, alternatives, reasoning_steps), `SseStepEvent` (type: 'step'), `SseResultEvent` (type: 'result'), `SseEvent` (discriminated union)
- [ ] T002 Export new types from `libs/shared/src/index.ts` for use by both apps/web and services/api
- [ ] T003 Verify exports: `pnpm nx build shared && pnpm nx lint shared`

**Checkpoint**: Shared types defined and exported; ready for service layer to import and implement

---

## Phase 2: Foundational — AiServiceModule (Blocking Prerequisite)

**Purpose**: Create the `AiServiceModule` with `IAiServiceClient` interface and `AiServiceClient` implementation. This abstraction handles all forwarding to the FastAPI AI service over HTTP. No consult-specific logic yet — pure forwarding infrastructure.

**⚠️ CRITICAL**: This phase MUST complete before any ConsultModule work begins. It blocks all user stories.

### Implementation for AiServiceModule

- [ ] T004 Create `services/api/src/ai-service/ai-service-client.interface.ts` with:
  - `IAiServiceClient` interface (methods: `consult(payload)` → Promise<AiConsultResponse>, `consultStream(payload)` → Promise<Readable>)
  - Types: `AiConsultPayload`, `AiPlaceResult`, `AiReasoningStep`, `AiConsultResponse` (reference @kebi-app/shared types)
  - Export `AI_SERVICE_CLIENT` injection token (Symbol)
- [ ] T005 Create `services/api/src/ai-service/ai-service.client.ts` implementing `IAiServiceClient`:
  - Use `node:http`/`node:https` (parse base URL to choose protocol)
  - `consult()`: POST to `/v1/consult`, collect response chunks, parse JSON, return `AiConsultResponse`
  - `consultStream()`: POST to `/v1/consult` with `stream: true`, return `IncomingMessage` (Readable stream)
  - Load base URL from `ConfigService.get<string>('ai_service.base_url')`
  - Set 20s timeout for consult (per api-contract.md)
  - Proper error handling and connection cleanup on errors
- [ ] T006 Create `services/api/src/ai-service/ai-service.module.ts`:
  - Provide `AiServiceClient` under `AI_SERVICE_CLIENT` token
  - Export `AI_SERVICE_CLIENT` token for injection in other modules
  - Import `ConfigModule` for configuration access
- [ ] T007 Update `services/api/config/.local.yaml` to add `ai_service.base_url: http://localhost:8000` for local development

### Tests for AiServiceModule

- [ ] T008 [P] Create `services/api/src/ai-service/ai-service.client.spec.ts`:
  - Mock `node:http.request` via `jest.spyOn(http, 'request')`
  - Test: `consult()` collects response body and parses JSON
  - Test: `consultStream()` returns a Readable stream
  - Test: Error handling for 5xx responses, timeouts
  - No nock dependency — use Jest spies only
- [ ] T009 Verify module typecheck: `pnpm nx build api`

**Checkpoint**: AiServiceModule complete, interface-first design in place, ready for ConsultModule to depend on it

---

## Phase 3: User Story 2 — Non-Streaming Consult Remains Unchanged (Priority: P2)

**Goal**: Implement the non-streaming path for `POST /api/v1/consult` so the endpoint accepts consult requests without streaming and returns a complete synchronous JSON response, maintaining backward compatibility with existing behavior.

**Independent Test**: Submit a consult request without `stream: true` and verify the response is a complete JSON object matching the existing contract (primary, alternatives, reasoning_steps).

### Implementation for User Story 2

- [ ] T010 [P] Create `services/api/src/consult/dto/consult-request.dto.ts` implementing `ConsultRequest`:
  - `query: string` — `@IsString() @IsNotEmpty() @MaxLength(1000)`
  - `location?: LocationCoordinates` — `@IsOptional() @ValidateNested() @Type(() => LocationDto)` with nested `lat` and `lng` validators
  - `stream?: boolean` — `@IsOptional() @IsBoolean()`
  - Also create nested `LocationDto` with lat/lng validation (min -90/90 for lat, -180/180 for lng)
- [ ] T011 [P] Create `services/api/src/consult/dto/consult-response.dto.ts` implementing `ConsultResponse`:
  - `primary: PlaceResultDto` — `@IsOptional()`
  - `alternatives: PlaceResultDto[]` — `@IsOptional()`
  - `reasoning_steps: ReasoningStepDto[]` — `@IsOptional()`
  - (All optional per ADR-019 — forward-compatible with evolving AI response)
  - Nested `PlaceResultDto` and `ReasoningStepDto` classes with appropriate validators
- [ ] T012 Create `services/api/src/consult/consult.service.ts`:
  - Inject `IAiServiceClient` via `@Inject(AI_SERVICE_CLIENT)`
  - `handle(userId: string, dto: ConsultRequestDto, req: Request, res: Response): Promise<void>`
  - Non-streaming path: Call `aiClient.consult(payload)`, call `res.json(result)`, return
  - (Streaming path will be added in Phase 4)
  - Proper error handling: map 4xx/5xx from AI service to appropriate HTTP responses
- [ ] T013 Create `services/api/src/consult/consult.controller.ts`:
  - `@Post()` endpoint at `/api/v1/consult` (global prefix added by NestJS)
  - `@Res({ passthrough: false })` and `@Req()` to capture request/response objects
  - `@RequiresAi()` decorator (ADR-022 — AiEnabledGuard for all AI endpoints)
  - One call: `await this.consultService.handle(user.id, dto, req, res)`
  - Extract userId from `@CurrentUser()` decorator (Clerk auth already set up)
  - No response returned (void) — service owns the response
- [ ] T014 Create `services/api/src/consult/consult.module.ts`:
  - Import `AiServiceModule`
  - Import `CommonModule` from NestJS
  - Provide `ConsultService`
  - Declare `ConsultController`
  - Make `ConsultModule` exportable
- [ ] T015 Update `services/api/src/app/app.module.ts`:
  - Import `ConsultModule` so the endpoint is registered
- [ ] T016 Verify non-streaming path works: `pnpm nx build api && pnpm nx lint api`

### Tests for User Story 2

- [ ] T017 [P] Create `services/api/src/consult/consult.controller.spec.ts`:
  - Mock `ConsultService`
  - Test: extracts userId from `@CurrentUser()`, passes dto to service
  - Test: calls `service.handle(userId, dto, req, res)`
- [ ] T018 [P] Create `services/api/src/consult/consult.service.spec.ts`:
  - Mock `IAiServiceClient` under `AI_SERVICE_CLIENT` token
  - Test non-streaming: calls `aiClient.consult(payload)`, calls `res.json(result)`
  - Test validation errors: missing `query`, invalid `stream` type

**Checkpoint**: User Story 2 complete. Non-streaming consult fully functional and independently testable.

---

## Phase 4: User Story 1 + User Story 3 — Streaming Path & Disconnect Cleanup (Priority: P1 + P3)

**Goal**: Add streaming mode to the ConsultModule so the endpoint accepts requests with `stream: true` and proxies the SSE stream from FastAPI to the browser. Implement disconnect cleanup so that when a client disconnects, the upstream AI connection is terminated promptly. Also implement backpressure handling so that slow clients do not cause upstream events to be dropped.

**Independent Tests**:
- **US1**: Submit consult with `stream: true` and observe reasoning steps arrive incrementally before the final result
- **US3**: Initiate a streaming consult and close the browser connection mid-stream, verify upstream AI connection terminates within 2 seconds

### Implementation for User Story 1 + User Story 3

- [ ] T019 Update `services/api/src/consult/consult.service.ts` to add streaming path:
  - Check `dto.stream === true` in `handle()` method
  - Non-streaming: existing code path (Phase 3)
  - Streaming: new code path:
    - `res.setHeader('Content-Type', 'text/event-stream')`
    - `res.setHeader('Cache-Control', 'no-cache')`
    - `res.setHeader('X-Accel-Buffering', 'no')` (prevent intermediate proxy buffering)
    - `res.flushHeaders()` to begin streaming
    - Call `const upstream = await this.aiClient.consultStream(payload)` to get Readable stream
    - **Disconnect cleanup (US3)**: `req.on('close', () => upstream.destroy())` to clean up upstream on client disconnect
    - **Backpressure handling (US3)**: Implement backpressure loop using `res.write()` return value and `upstream.pause()`/`resume()` on drain event
    - Use `stream.pipeline(upstream, res, (err) => { if (err && !res.writableEnded) res.end() })` for safe stream composition
    - Proper error handling: if upstream errors, close the response cleanly
- [ ] T020 Verify streaming path and backpressure: `pnpm nx build api && pnpm nx lint api`

### Tests for User Story 1 + User Story 3

- [ ] T021 [P] Update `services/api/src/consult/consult.service.spec.ts` to add streaming tests:
  - Test streaming: sets SSE headers, calls `aiClient.consultStream()`, calls `res.flushHeaders()`
  - Test disconnect cleanup (US3): `req.on('close')` triggers `upstream.destroy()`
  - Test backpressure: slow consumer does not cause data loss
  - Mock Readable stream for upstream
- [ ] T022 Test backpressure scenario: Create a test that simulates a slow consumer and verifies all events are delivered without overflow

**Checkpoint**: User Story 1 and User Story 3 complete. Streaming works with proper cleanup and backpressure handling. All three user stories now fully functional.

---

## Phase 5: Polish — Unit Tests & API Documentation

**Purpose**: Complete test coverage and add Bruno API request file for manual testing and documentation.

- [ ] T023 [P] Run full test suite: `pnpm nx test api`
  - All tests from T008, T017, T018, T021, T022 should pass
  - Service tests: non-streaming, streaming, disconnect cleanup, backpressure
  - Controller tests: userId extraction, service delegation
  - Client tests: HTTP request/response mocking
- [ ] T024 [P] Run lint: `pnpm nx lint api`
  - No ESLint errors
  - No inline disables without comments
- [ ] T025 Create `kebi-config/bruno/nestjs-api/consult-stream.bru`:
  - Two examples: non-streaming request and streaming request
  - Non-streaming: `POST /api/v1/consult` with `stream: false` or omitted, expected response: complete JSON
  - Streaming: `POST /api/v1/consult` with `stream: true`, expected response: SSE events
  - Include auth headers (Clerk token), example query, location
  - Instructions in comments for testing with Bruno
- [ ] T026 Run quickstart validation: Follow `specs/001-consult-sse-proxy/quickstart.md` steps
  - Test non-streaming with curl
  - Test streaming with curl -N flag
  - Test disconnect cleanup by pressing Ctrl+C mid-stream
  - Verify logs show cleanup

**Checkpoint**: Complete test coverage. Feature ready for deployment.

---

## Phase 6: Verify & Completion

**Purpose**: Final verification that all user stories work correctly and integration is solid.

- [ ] T027 Full integration test: `pnpm nx affected -t test,lint`
  - shared, api, web all pass tests and lint
- [ ] T028 Manual end-to-end test:
  - Start NestJS: `pnpm nx serve api`
  - Start FastAPI locally (if available): `uvicorn main:app --reload`
  - Test non-streaming consult via Bruno
  - Test streaming consult via Bruno
  - Test disconnect cleanup
- [ ] T029 Commit all changes with message: `feat(api): add consult SSE proxy endpoint with streaming support`
  - Include all new files from phases 1-5
  - Include updates to shared types, app.module.ts, config
- [ ] T030 Verify plan checklist completion:
  - [ ] `POST /api/v1/consult` with `stream: true` proxies SSE from FastAPI to browser ✓
  - [ ] `POST /api/v1/consult` without `stream` returns synchronous JSON unchanged ✓
  - [ ] Client disconnect terminates upstream FastAPI connection ✓
  - [ ] `pnpm nx test api` passes ✓
  - [ ] `pnpm nx lint api` passes ✓
  - [ ] `kebi-config/bruno/nestjs-api/consult-stream.bru` committed ✓

**Checkpoint**: Feature complete and ready for code review / deployment.

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Title | Depends On | Blocking |
|-------|-------|-----------|----------|
| Phase 1 | Shared Types | Nothing | Blocks all other phases |
| Phase 2 | AiServiceModule | Phase 1 | Blocks Phase 3 & 4 |
| Phase 3 | US2 Non-Streaming | Phase 1 & 2 | Can proceed independently once Phases 1-2 done |
| Phase 4 | US1 + US3 Streaming | Phase 1 & 2 (& Phase 3 for full integration) | Can proceed after Phase 3 or in parallel |
| Phase 5 | Tests & Polish | Phase 3 & 4 | Quality gate |
| Phase 6 | Verify & Complete | Phase 5 | Final checkpoint |

### User Story Dependencies

- **US2 (P2 - Non-Streaming)**: Can start after Phase 2 completes. Fully independent, can be tested and deployed alone.
- **US1 (P1 - Streaming)**: Depends on Phase 2. Requires Phase 3 to be complete for full consult support.
- **US3 (P3 - Disconnect Cleanup)**: Integral to US1 (streaming implementation). Tested together in Phase 4.

### Parallel Opportunities Within Phases

**Phase 1 (Shared Types)**:
- T001, T002, T003 are sequential but quick

**Phase 2 (AiServiceModule)**:
- T004, T005 can start in parallel (both create interface/client files)
- T008 (tests) can run in parallel with T006, T007

**Phase 3 (US2)**:
- T010, T011 can run in parallel (both create DTOs)
- T017, T018 (tests) can run in parallel with T012-T015

**Phase 4 (US1 + US3)**:
- T019, T020 are sequential (same file, streaming addition)
- T021, T022 (tests) can run in parallel

**Phase 5 (Tests & Polish)**:
- T023, T024 can run in parallel (different test types)
- T025, T026 can run in parallel (Bruno file + quickstart validation)

---

## Implementation Strategy

### MVP First (User Story 2 Only)

Deploy just non-streaming first for minimal risk:

1. ✓ Complete Phase 1: Shared types
2. ✓ Complete Phase 2: AiServiceModule
3. ✓ Complete Phase 3: ConsultModule non-streaming
4. **STOP and VALIDATE**: Test non-streaming independently
5. Deploy to staging/production if ready
6. Then add US1 + US3 (streaming) in Phase 4 as an enhancement

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Phase 3 → Non-streaming works, backward compatible ✓ Deploy/Demo
3. Phase 4 → Add streaming + cleanup ✓ Deploy/Demo
4. Phase 5 → Full test coverage + documentation
5. Phase 6 → Verification complete, ready for production

### Full Team Strategy (if available)

1. All: Complete Phase 1 + 2 together (blocking prerequisites)
2. Once foundation is solid:
   - Developer A: Phase 3 (non-streaming path)
   - Developer B: Phase 4 (streaming path)
3. Both can work independently; US2 can ship before US1
4. Phase 5 + 6: Code review and final validation

---

## Summary

| Phase | Duration | Tasks | User Stories | Blocker |
|-------|----------|-------|--------------|---------|
| 1 | 30m | T001-T003 | All | Yes |
| 2 | 1-2h | T004-T009 | All | Yes |
| 3 | 2-3h | T010-T018 | US2 | No (after 1,2) |
| 4 | 2-3h | T019-T022 | US1, US3 | No (after 1,2) |
| 5 | 1h | T023-T026 | Polish | No (after 3,4) |
| 6 | 30m | T027-T030 | Verification | No (after 5) |

**Total: ~7-10 hours** (estimated for one developer)

**Critical Path**: Phase 1 → Phase 2 → (Phase 3 || Phase 4 in parallel) → Phase 5 → Phase 6

---

## File Summary

### Files to Create

**libs/shared/**
- `src/lib/types.ts` (add 8 new types)

**services/api/src/ai-service/**
- `ai-service-client.interface.ts` (interface + Symbol token)
- `ai-service.client.ts` (HTTP implementation)
- `ai-service.module.ts` (NestJS module)
- `ai-service.client.spec.ts` (unit tests)

**services/api/src/consult/**
- `dto/consult-request.dto.ts` (request validation)
- `dto/consult-response.dto.ts` (response shape)
- `consult.service.ts` (business logic — non-streaming + streaming)
- `consult.controller.ts` (HTTP endpoint facade)
- `consult.module.ts` (NestJS module)
- `consult.controller.spec.ts` (unit tests)
- `consult.service.spec.ts` (unit tests)

**services/api/**
- `src/app/app.module.ts` (modify — import ConsultModule)
- `config/.local.yaml` (modify — add ai_service.base_url)

**kebi-config/bruno/**
- `nestjs-api/consult-stream.bru` (API documentation + examples)

### Total New/Modified Files: 16 files
