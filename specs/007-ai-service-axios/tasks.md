# Task List: AI Service Client — Migrate to Axios and Add extractPlace

**Feature**: `001-ai-service-axios` | **Branch**: `001-ai-service-axios`
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

---

## Overview

This task list implements the migration of `AiServiceClient` from `node:http`/`node:https` to NestJS `HttpModule` (Axios), plus the addition of `extractPlace()` method for place extraction requests.

**Total Tasks**: 12 | **Parallel Opportunities**: 6 tasks can run in parallel after Phase 1 completes
**Estimated scope**: ~4–6 hours for experienced NestJS developer
**MVP**: Complete Phase 1 + Phase 2 + Phase 3 (add extractPlace) = feature ready for Places domain

---

## Task Phases

### Phase 1: Setup & Infrastructure

- [X] T001 Install `@nestjs/axios` and `axios` packages via `pnpm --filter @kebi-app/api add @nestjs/axios axios` in `services/api/package.json`
- [X] T002 Verify NestJS 11 and rxjs 7.8.0 are installed in `services/api/` — they are dependencies already

**Completion**: Both packages confirmed installed.

---

### Phase 2: Foundational — Update Module & Constructor

- [X] T003 Register `HttpModule` from `@nestjs/axios` in `services/api/src/ai-service/ai-service.module.ts` — add to `imports: [ConfigModule, HttpModule]`
- [X] T004 [P] Update `AiServiceClient` constructor in `services/api/src/ai-service/ai-service.client.ts` to inject `HttpService` as second parameter alongside `ConfigService`
- [X] T005 [P] Remove all `node:http`, `node:https`, `node:url`, `stream` imports from `services/api/src/ai-service/ai-service.client.ts`
- [X] T006 [P] Add imports for `HttpService` from `@nestjs/axios`, `firstValueFrom` from `rxjs`

**Completion**: Module and constructor ready for HTTP method implementations.

---

### Phase 3: User Story 1 — Add extractPlace Method [US1]

**Goal**: Enable the Places domain to call the `extractPlace()` endpoint on the AI service client.

**Independent Test Criteria**:
- `extractPlace()` method exists on `IAiServiceClient` interface
- `extractPlace()` accepts `AiExtractPlacePayload` and returns `Promise<AiExtractPlaceResponse>`
- Calling `extractPlace()` with a valid payload makes an HTTP POST request to `/v1/extract-place`
- The method respects the 10-second timeout per FR-003
- Response types match the api-contract.md schema exactly per FR-005 and FR-006

- [X] T007 [US1] Add `AiExtractPlacePayload` type to `services/api/src/ai-service/ai-service-client.interface.ts` — exactly `{ user_id: string; raw_input: string }`
- [X] T008 [US1] Add `AiExtractedPlace` nested type to `services/api/src/ai-service/ai-service-client.interface.ts` — with `place_name`, `address`, `cuisine`, `price_range` (all nullable strings)
- [X] T009 [US1] Add `AiExtractPlaceResponse` type to `services/api/src/ai-service/ai-service-client.interface.ts` — with `place_id` (nullable string), `place` (AiExtractedPlace), `confidence` (number), `status` ('resolved' | 'unresolved'), `requires_confirmation` (boolean), `source_url` (nullable string)
- [X] T010 [US1] Add `extractPlace(payload: AiExtractPlacePayload): Promise<AiExtractPlaceResponse>` method signature to `IAiServiceClient` interface in `services/api/src/ai-service/ai-service-client.interface.ts`
- [X] T011 [US1] Implement `extractPlace()` method in `AiServiceClient` class in `services/api/src/ai-service/ai-service.client.ts` — call `POST /v1/extract-place` via `firstValueFrom(httpService.post(...))` with 10s timeout, return `response.data` unmodified, let `AxiosError` propagate raw per FR-002

**Completion**: `extractPlace()` available on the interface and implementation. Places domain can now call the method.

---

### Phase 4: User Story 2 — Migrate consult & consultStream to Axios [US2]

**Goal**: Preserve existing functionality for `consult()` and `consultStream()` after switching to Axios transport.

**Independent Test Criteria**:
- Existing unit tests for `consult()` and `consultStream()` pass without modification
- No `node:http` or `node:https` imports exist in `ai-service/` module directory (SC-002)
- `consult()` still respects the 20-second timeout per FR-007
- `consultStream()` still returns a stream compatible with `pipe()` per FR-008
- All existing domain service callers work unchanged (facade pattern preserved per FR-009)

- [X] T012 [US2] Migrate `consult()` method in `services/api/src/ai-service/ai-service.client.ts` — use `firstValueFrom(httpService.post('/v1/consult', payload, { timeout: 20000 }))` and return `response.data`, let `AxiosError` propagate raw
- [X] T013 [US2] Migrate `consultStream()` method in `services/api/src/ai-service/ai-service.client.ts` — use `firstValueFrom(httpService.post('/v1/consult', {..., responseType: 'stream', timeout: 20000}))` and return `response.data` (which is a `Readable` stream), let `AxiosError` propagate raw
- [X] T014 [US2] Update `services/api/src/ai-service/ai-service.client.spec.ts` — add `HttpService` mock to constructor call in `beforeEach`
- [X] T015 [US2] Add unit test in `services/api/src/ai-service/ai-service.client.spec.ts` — verify `extractPlace()` method exists and has correct signature

**Completion**: `consult()` and `consultStream()` fully migrated to Axios. Existing tests updated. No regressions expected.

---

### Phase 5: User Story 3 — Type Contract Verification [US3]

**Goal**: Ensure all TypeScript types match api-contract.md exactly with no field mismatches.

**Independent Test Criteria**:
- TypeScript compilation reports zero errors in the `ai-service` module (SC-003)
- A type-level assignment test confirms raw JSON from api-contract.md matches `AiExtractPlaceResponse`
- All field names and nullability match the contract exactly

- [X] T016 [US3] Create type-level test in `services/api/src/ai-service/ai-service.client.spec.ts` — declare a raw JSON object matching the api-contract.md response schema and assign it to `AiExtractPlaceResponse` type — TypeScript should report zero errors if types match

**Completion**: Type contract validated. Zero TypeScript errors in the module.

---

### Phase 6: Final Verification & Regression Testing

- [X] T017 Run `pnpm nx test api` in `services/api/` — all tests pass including updated `ai-service.client.spec.ts`
- [X] T018 Run `pnpm nx lint api` in `services/api/` — zero errors/warnings in `ai-service/` directory (SC-006)
- [X] T019 Verify no `node:http` or `node:https` imports remain via `grep -r "node:http\|node:https" services/api/src/ai-service/` — must return empty (SC-002)
- [X] T020 Verify `AiServiceClient` is properly injected in all domain services that use it — check `ConsultService` and `PlacesService` (if exists) — no call-site changes required (FR-009)

**Completion**: All success criteria met. Feature ready for merge.

---

## Task Dependencies & Parallelization

### Execution Order

```
Phase 1 Setup
├── T001 Install packages
└── T002 Verify installation
    ↓
Phase 2 Foundational
├── T003 Register HttpModule
├── T004 Update constructor [P]
├── T005 Remove old imports [P]
└── T006 Add new imports [P]
    ↓
Phase 3 User Story 1 [US1] - extractPlace Add
├── T007 Add AiExtractPlacePayload type [P]
├── T008 Add AiExtractedPlace type [P]
├── T009 Add AiExtractPlaceResponse type [P]
├── T010 Add extractPlace method to interface [P]
└── T011 Implement extractPlace in client
    ↓
Phase 4 User Story 2 [US2] - Migrate to Axios
├── T012 Migrate consult() [P]
├── T013 Migrate consultStream() [P]
├── T014 Update test mocks [P]
└── T015 Add extractPlace test
    ↓
Phase 5 User Story 3 [US3] - Type Verification
└── T016 Type-level test
    ↓
Phase 6 Final Verification
├── T017 Run tests
├── T018 Run lint
├── T019 Verify import cleanup
└── T020 Verify call-site facade pattern
```

### Parallel Execution Examples

**After Phase 2 completes (T006), the following can run in parallel**:
- T007, T008, T009, T010 — all add types/signatures to interface file (non-overlapping sections)
- T012, T013 — migrate two different methods

**Within US2 testing** (after T011 completes):
- T014, T015 — both update the test file (sequential, apply one then the other)

---

## Implementation Strategy

### MVP Scope (First Implementation)
Complete Phases 1 → 2 → 3 (T001 through T011):
- Installs Axios
- Registers `HttpModule`
- Adds `extractPlace()` fully functional
- Preserves existing methods (no migration yet)

**Result**: Places domain can now use `extractPlace()`. Existing `consult()` and `consultStream()` still use old `node:http` (but they should still work since the client is instantiated before the migration).

Actually wait — let me reconsider. Once the constructor changes (T004), the old methods WILL break because they still expect the old transport pattern (node:http promise-based). So Phase 2 → Phase 3 must be done together, OR Phase 3 must include the migration of at least one existing method before testing.

Better MVP: Phases 1 → 2 → 3 → 4 (complete all methods). Phase 5 is type validation (quick). Phase 6 is testing/cleanup.

### Incremental Delivery

1. **Minimum Viable**: Phases 1 + 2 + 3 + 4 — full migration complete, all methods working
2. **Nice to have**: Phase 5 — type verification (already done via TS compilation)
3. **Polish**: Phase 6 — tests, lint, regression checks

---

## Notes for Implementation

- **No router changes**: This refactoring is internal to `AiServiceClient`. No new endpoints are added. Route handlers do not change (FR-009).
- **Error handling**: `AxiosError` propagates raw. The `AllExceptionsFilter` (ADR-018) will handle error translation in a future task — not part of this implementation.
- **Testing philosophy**: Existing tests will be updated to mock `HttpService` instead of using `node:http`. The test structure remains the same.
- **Constructor injection**: The migration adds `HttpService` as a dependency. Existing callers (domain services) do not change because they inject `IAiServiceClient` interface, not the concrete class.
