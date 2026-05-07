---
description: "Task list for Wire Consult Streaming feature implementation"
---

# Tasks: Wire Consult Streaming

**Feature**: `001-wire-consult-streaming`
**Branch**: `001-wire-consult-streaming`
**Input**: Design documents from `/specs/001-wire-consult-streaming/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story (P1, P2, P3) to enable independent implementation and testing of each story.

**Format**: `- [ ] [TaskID] [P?] [Story?] Description with file path`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

**Status**: All tasks required before Phase 2 can begin

- [x] T001 Install `@ai-sdk/react` and `ai` packages in `apps/web` using `pnpm --filter @kebi-app/web add @ai-sdk/react ai`
- [x] T002 [P] Extend `HttpClient` interface with `postStream` method in `apps/web/src/api/types.ts` — add signature `postStream(path: string, body: unknown): Promise<Response>`
- [x] T003 [P] Implement `postStream` method in `FetchClient` class in `apps/web/src/api/transports/fetch.transport.ts` — follow pattern from `post` method but return raw `Response` without calling `.json()`

**Checkpoint**: Phase 1 complete — API transport layer extended and dependencies installed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create server-side API client factory in `apps/web/src/api/server.ts` — export `getApiClient()` function that uses `auth()` from `@clerk/nextjs/server` to retrieve Clerk token and call `createApiClient()`
- [x] T005 Create BFF route handler at `apps/web/src/app/api/consult/route.ts` — implement POST endpoint that:
  - Calls `await auth()` from `@clerk/nextjs/server` and returns 401 if `userId` is null
  - Extracts query from request body: `messages.at(-1)?.content`
  - Calls `getApiClient().postStream('/api/v1/consult', { query, stream: true })`
  - Transforms SSE stream through `TransformStream` — extract `content` from events where `type === "token"` and write to output
  - Returns `Response` with `Content-Type: text/plain; charset=utf-8`
  - Handle `[DONE]` marker and close stream on upstream disconnect

**Checkpoint**: Foundation complete — route handler can receive requests from browser and forward to NestJS

---

## Phase 3: User Story 1 - Real-Time Recommendation Streaming (Priority: P1) 🎯 MVP

**Goal**: Users see recommendation responses appear progressively token-by-token as streaming completes, not all at once after a long wait.

**Independent Test**: Type a recommendation query (e.g., "best ramen near me for a date") into the home page chat and observe that the response bubble begins populating with text before the full answer is ready. Verify loading indicator shows during streaming and disappears on completion.

### Implementation for User Story 1

- [x] T006 [US1] Extend `AgentResponseBubble` with streaming phase transition in `apps/web/src/components/AgentResponseBubble.tsx` — add `useEffect` that transitions phase from `'thinking'` to `'result'` when `content` prop becomes non-empty: `if (content && phase === 'thinking') { setPhase('result') }`
- [x] T007 [P] [US1] Wire `useChat` into home page for recommend flow in `apps/web/src/app/[locale]/(main)/home/page.tsx`:
  - Import `useChat` from `@ai-sdk/react`
  - Call `useChat({ api: '/api/consult', streamProtocol: 'text' })`
  - In `handleSend()`, route `flow === 'recommend'` queries to `useChat.append({ role: 'user', content: text })`
  - Build display message list by merging local messages with mapped `consultMessages`
  - Pass `isConsulting` to `ChatInput` for disabled state
  - Render `AgentResponseBubble` with `content={msg.content}` for recommend flow

- [x] T008 [US1] Verify loading and disabled states work correctly:
  - Confirm `ChatInput` is disabled while `useChat` is loading (`isConsulting === true`)
  - Confirm `ChatInput` re-enables when stream completes or fails
  - Verify loading indicator in `AgentResponseBubble` shows while streaming

**Checkpoint**: User Story 1 complete — recommendation streaming works end-to-end with progressive token rendering

---

## Phase 4: User Story 2 - Recommendation Error Handling (Priority: P2)

**Goal**: Users see clear error messages when recommendation requests fail, without crashing the page or breaking other flows.

**Independent Test**: Simulate a failed recommendation request (e.g., by mocking the route handler to return an error) and verify that an error message appears in the chat and the input field becomes active for retry.

### Implementation for User Story 2

- [x] T009 [US2] Implement `consultError` display in home page in `apps/web/src/app/[locale]/(main)/home/page.tsx` — pass `consultError` from `useChat` to `AgentResponseBubble` or add error message display logic
- [x] T010 [US2] Add error state handling to `AgentResponseBubble` — display error message when `hasError` prop is true and prevent further rendering of incomplete content
- [x] T011 [US2] Verify error recovery flow works:
  - Confirm error message displays in chat when `consultError` is present
  - Confirm input field is enabled and user can retry after error
  - Confirm previous messages in chat are still visible after error

**Checkpoint**: User Story 2 complete — errors are visible and recoverable

---

## Phase 5: User Story 3 - Existing UI and Flows Unchanged (Priority: P3)

**Goal**: Every part of the home page that is not directly involved in recommendation streaming remains visually and behaviourally identical.

**Independent Test**: Load the home page with no active query and compare the layout and empty state to the pre-change baseline. Trigger recall and add-place flows and confirm they produce identical output and behaviour.

### Implementation for User Story 3

- [x] T012 [US3] Verify recall flow behavior is unchanged in `apps/web/src/app/[locale]/(main)/home/page.tsx`:
  - Confirm `flow === 'recall'` queries still use local `messages` state (no `useChat`)
  - Confirm recall responses appear in `allMessages` list in correct order
  - Confirm recall loading state still shows via local state (not `useChat`)

- [x] T013 [US3] Verify add-place flow behavior is unchanged in `apps/web/src/app/[locale]/(main)/home/page.tsx`:
  - Confirm `flow === 'add-place'` queries still use local `messages` state (no `useChat`)
  - Confirm add-place responses appear in `allMessages` list in correct order
  - Confirm add-place loading state still shows via local state (not `useChat`)

- [x] T014 [US3] Verify UI component files are unmodified (except `AgentResponseBubble` and `HomePage`):
  - Check that `ChatMessage.tsx`, `HomeEmptyState.tsx`, `ChatInput.tsx` source code is identical to pre-change state
  - Confirm visual layout and styling of home page is unchanged
  - Verify empty state renders identically when page first loads

**Checkpoint**: User Story 3 complete — existing flows and UI are unaffected

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification and final quality checks across all stories

- [x] T015 [P] Run test verification: `pnpm nx test web` from repo root — confirm all tests pass with zero regressions
- [x] T016 [P] Run lint verification: `pnpm nx lint web` from repo root — confirm no lint errors or warnings
- [x] T017 Fix any lint issues discovered in T016 (likely unused imports or type mismatches) — do not suppress rules inline without comments
- [x] T018 Verify all tasks from plan.md Step 8 are complete:
  - `pnpm nx test web` passes ✓
  - `pnpm nx lint web` passes ✓
  - All code changes follow CLAUDE.md standards (ADR-029, ADR-030, etc.)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can proceed sequentially in priority order (US1 → US2 → US3)
  - Or in parallel if team capacity allows (all three can start after Foundational completes)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational phase — independent from US2 and US3
- **User Story 2 (P2)**: Can start after Foundational phase — builds on US1 but independently testable
- **User Story 3 (P3)**: Can start after Foundational phase — verification task, independent from US1 and US2

### Within User Story 1

- T006 can run after Phase 2 (no dependencies)
- T007 can run after Phase 2 (no dependencies)
- Both can run in parallel
- T008 depends on T006 and T007 completion

### Within User Story 2

- T009 depends on T007 (US1 HomePage wiring)
- T010 depends on T006 (AgentResponseBubble extension)
- T011 depends on T009 and T010

### Within User Story 3

- T012, T013, T014 can run in parallel (different verification areas)

---

## Parallel Execution Opportunities

### Setup Phase (Phase 1)

```bash
# T001 installs packages first (required for T002/T003)
# Then T002 and T003 can run in parallel (different files):
Task: "Extend HttpClient interface with postStream in apps/web/src/api/types.ts"
Task: "Implement postStream in FetchClient in apps/web/src/api/transports/fetch.transport.ts"
```

### Foundational Phase (Phase 2)

```bash
# T004 and T005 are sequential (T005 needs T004's getApiClient):
# T004 first: Create server.ts
# T005 second: Create route handler that uses server.ts
```

### User Story 1 (Phase 3)

```bash
# T006 and T007 can run in parallel (different files):
Task: "Extend AgentResponseBubble with streaming phase transition"
Task: "Wire useChat into HomePage for recommend flow"
# Then T008 depends on both
```

### User Story 2 (Phase 4)

```bash
# T009 and T010 depend on US1 completion
# T009 and T010 can run in parallel:
Task: "Implement consultError display in HomePage"
Task: "Add error state handling to AgentResponseBubble"
# Then T011 depends on both
```

### User Story 3 (Phase 5)

```bash
# All three verification tasks can run in parallel:
Task: "Verify recall flow behavior is unchanged"
Task: "Verify add-place flow behavior is unchanged"
Task: "Verify UI component files are unmodified"
```

### Polish Phase (Phase 6)

```bash
# T015 and T016 can run in parallel:
Task: "Run test verification: pnpm nx test web"
Task: "Run lint verification: pnpm nx lint web"
# Then T017 fixes issues from T016
# Then T018 final verification
```

---

## Implementation Strategy

### MVP First (User Story 1 Only) — Recommended Path

1. **Complete Phase 1 (Setup)**: Install packages, extend API layer
2. **Complete Phase 2 (Foundational)**: Create route handler infrastructure
3. **Complete Phase 3 (User Story 1)**: Wire streaming UI
4. **STOP and VALIDATE**: Run tests (`pnpm nx test web`), manually test recommendation query
5. **Deploy**: Push to dev/staging for user testing

### Incremental Delivery

1. **Setup + Foundational** → Foundation ready for any story
2. **Add User Story 1** → Test independently → Deploy (MVP!)
3. **Add User Story 2** → Test independently → Deploy
4. **Add User Story 3** → Verification → Deploy
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers (optional if team size allows):

1. **All team members**: Complete Setup + Foundational together
2. **Once Foundational is done**:
   - Developer A: User Story 1 (T006 + T007 + T008)
   - Developer B: User Story 2 (T009 + T010 + T011) — can start immediately
   - Developer C: User Story 3 (T012 + T013 + T014) — can start immediately
3. **Merge order**: Complete stories sequentially (US1 → US2 → US3) to maintain clear commit history

---

## Task Summary

| Phase | Count | Description |
|-------|-------|-------------|
| Phase 1 (Setup) | 3 | Install packages, extend API interfaces |
| Phase 2 (Foundational) | 2 | Create server client and route handler |
| Phase 3 (US1 - Streaming) | 3 | Wire useChat, extend bubble, verify states |
| Phase 4 (US2 - Error Handling) | 3 | Implement error display and recovery |
| Phase 5 (US3 - UI Unchanged) | 3 | Verify existing flows and components |
| Phase 6 (Polish) | 4 | Tests, lint, final verification |
| **TOTAL** | **18** | **All tasks required for complete feature** |

---

## Notes

- **[P] marker**: Tasks with [P] can run in parallel (different files, no sequential dependencies within that phase)
- **[Story] label**: Maps task to specific user story (US1, US2, US3) for traceability
- **No tests included**: Feature spec did not request TDD or pre-written tests — focus is on implementation
- **Commit strategy**: Commit after each phase completes (or per user story if working in parallel)
- **Verification checkpoints**: Stop at each checkpoint to validate story independently before moving to next
- **ADR compliance**: All tasks follow ADR-029 (injected HTTP client), ADR-030 (interfaces via classes), and ADR-013 (Clerk auth)
