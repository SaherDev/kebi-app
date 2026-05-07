# Tasks: Gateway Per-User Rate Limiting

**Input**: Design documents from `specs/016-gateway-rate-limit/`  
**Branch**: `016-gateway-rate-limit`  
**Spec**: spec.md | **Plan**: plan.md | **Data Model**: data-model.md | **Contracts**: contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story this task belongs to (US1–US4)
- No [Story] label = Setup or Foundational task

---

## Phase 1: Setup

**Purpose**: Docs and API contract update before any code changes

- [x] T001 Update `docs/api-contract.md` POST /v1/chat response table — add `tool_calls_used: number` (always present) and `session_started?: true` (present only on new session, absent otherwise) to the shared response fields; note applies to all intent types

---

## Phase 2: Foundation (Blocking Prerequisites)

**Purpose**: Shared types, config, auth migration, and rate-limit core — MUST complete before any user story

**⚠️ CRITICAL**: All user story phases depend on this phase

- [x] T002 [P] Add `PlanTier = 'homebody' | 'explorer' | 'local_legend'` and `AuthUser { id: string; ai_enabled: boolean; plan?: PlanTier }` to `libs/shared/src/lib/types.ts`
- [x] T003 [P] Extend `ChatResponseDto` in `libs/shared/src/lib/types.ts` — add `tool_calls_used: number` and `session_started?: true` fields
- [x] T004 Export `PlanTier` and `AuthUser` from `libs/shared/src/index.ts` (after T002)
- [x] T005 [P] Add `rate_limits` block to `services/api/config/app.yaml` — `default_plan: homebody`; plans: homebody (sessions_per_day:3, tool_calls_per_day:30, turns_per_session:10), explorer (10/100/20), local_legend (20/200/30)
- [x] T006 Update `services/api/src/common/middleware/clerk.middleware.ts` — import `AuthUser`, `PlanTier` from `@kebi-app/shared`; extract `plan` from `verifiedSession.public_metadata` typed as `PlanTier | undefined`; populate `req.user = { id, ai_enabled, plan }`; remove local `ClerkUser` interface; update `Express.Request.user` augmentation to use imported `AuthUser` (after T002, T004)
- [x] T007 Update `services/api/src/common/guards/ai-enabled.guard.ts` — replace `import { ClerkUser } from '../middleware/clerk.middleware'` with `import { AuthUser } from '@kebi-app/shared'`; update `request.user as AuthUser` cast (after T002, T004)
- [x] T008 Create `services/api/src/rate-limit/rate-limit.service.ts` — `@Injectable()` class with `Map<string, UserRateLimitState>` private field; implement `getTodayUtc()` via `new Date().toISOString().slice(0,10)` (UTC always, never local date methods); `resetIfNewDay(counter)`; `getOrCreate(userId)` lazy init; `check(userId, thresholds): RateLimitBreach | null` checks in order tool_calls_per_day → turns_per_session → sessions_per_day, resets stale daily counters before each check; `incrementTurns(userId)`; `onSessionStarted(userId)` increments sessions + sets turns to 1; `addToolCalls(userId, n)` resets if new day then adds n; `resetTurns(userId)` sets turns to 0 (after T005)
- [x] T009 Create `services/api/src/rate-limit/rate-limit.service.spec.ts` — Jest unit tests: (1) check() returns null when all counters under threshold; (2) check() returns correct breach for each of the three limit types; (3) check() respects order (tool_calls checked before turns, turns before sessions); (4) check() resets daily counter when stored date is yesterday UTC; (5) onSessionStarted() increments sessions and sets turns to 1; (6) resetTurns() sets turns to 0 without changing sessions or toolCalls (after T008)
- [x] T010 Create `services/api/src/rate-limit/rate-limit.module.ts` — `@Module({ providers: [RateLimitService], exports: [RateLimitService] })` (after T008)
- [x] T011 Update `services/api/src/chat/chat.module.ts` — import `RateLimitModule` so `RateLimitService` is available to guards running in ChatController context (after T010)
- [x] T012 Update `services/api/src/app/app.module.ts` — import `RateLimitModule` so `RateLimitService` is available to `ClerkWebhookController` (after T010)

**Checkpoint**: Run `pnpm nx build api` and `pnpm nx test api` — must pass before US phases begin

---

## Phase 3: User Story 1 — Session cap breach (Priority: P1) 🎯 MVP

**Goal**: `RateLimitGuard` is applied to `POST /api/v1/chat`; a user whose `sessions_per_day` counter is at or above their plan threshold gets a 429 with the correct body before FastAPI is called.

**Independent Test**: Set `sessions.count` to 3 for a homebody user; send a message; expect `429 { "error": "rate_limit_exceeded", "limit": "sessions_per_day", "limit_value": 3 }`.

### Implementation

- [x] T013 [US1] Create `services/api/src/common/guards/rate-limit.guard.ts` — `@Injectable() RateLimitGuard implements CanActivate`; inject `RateLimitService` and `ConfigService`; in `canActivate`: read `req.user as AuthUser`; resolve plan as `user.plan ?? configService.get<string>('rate_limits.default_plan')`; load `PlanThresholds` via `configService.get<PlanThresholds>('rate_limits.plans.<plan>')`; call `rateLimitService.check(userId, thresholds)`; on breach throw `new HttpException({ error: 'rate_limit_exceeded', limit: breach.limit, limit_value: breach.limit_value }, HttpStatus.TOO_MANY_REQUESTS)` (after T008, T010, T011)
- [x] T014 [US1] Update `services/api/src/chat/chat.controller.ts` — add `@UseGuards(RateLimitGuard)` decorator to the `@Post()` method alongside the existing `@RequiresAi()` decorator; import `RateLimitGuard` (after T013)
- [x] T015 [US1] Create `kebi-config/bruno/rate-limit/sessions-breach.bru` — POST to `{{base_url}}/chat` with `Authorization: Bearer {{auth_token}}`; precondition note: user's sessions.count is at plan threshold; assert status 429 and body `{ "error": "rate_limit_exceeded", "limit": "sessions_per_day", "limit_value": 3 }`

**Checkpoint**: Guard is live; session cap and default-plan fallback are testable end-to-end

---

## Phase 4: User Story 2 — Turns per session breach (Priority: P1)

**Goal**: `turns_per_session` accumulates on every forwarded message; a user who has sent `turns_per_session` turns in the current session is blocked on their next message.

**Independent Test**: With guard passing (sessions and tool_calls under limit), set `turns` to 10 for a homebody user; send a message; expect `429 { "error": "rate_limit_exceeded", "limit": "turns_per_session", "limit_value": 10 }`.

### Implementation

- [x] T016 [US2] Update `services/api/src/chat/chat.service.ts` — inject `RateLimitService`; at the start of `chat(userId, dto)` call `rateLimitService.incrementTurns(userId)` before calling `aiClient.chat()`; keep the rest of the method unchanged for now (after T008, T011)
- [x] T017 [US2] Create `kebi-config/bruno/rate-limit/turns-breach.bru` — POST to `{{base_url}}/chat`; precondition note: user's turns is at plan threshold (10 for homebody); assert status 429 and body `{ "error": "rate_limit_exceeded", "limit": "turns_per_session", "limit_value": 10 }`

**Checkpoint**: Turns accumulate on every forwarded message; turns breach is testable independently of session and tool-call limits

---

## Phase 5: User Story 3 — Tool calls breach (Priority: P2)

**Goal**: After each chat response, NestJS reads `tool_calls_used` and `session_started?` from the response and updates the in-memory counters; once `tool_calls_per_day` reaches the plan threshold the next request is blocked.

**Independent Test**: Accumulate `toolCalls.count` to 30 for a homebody user via done events; send a message; expect `429 { "error": "rate_limit_exceeded", "limit": "tool_calls_per_day", "limit_value": 30 }`. Also: send a request with a user token that has no `plan` field in public_metadata; verify 429 uses `limit_value: 30` (homebody default).

### Implementation

- [x] T018 [US3] Update `services/api/src/chat/chat.service.ts` — after `aiClient.chat()` returns: call `rateLimitService.addToolCalls(userId, response.tool_calls_used ?? 0)`; if `response.session_started === true` call `rateLimitService.onSessionStarted(userId)`; return response unchanged (after T016 — same file, sequential)
- [x] T019 [P] [US3] Create `kebi-config/bruno/rate-limit/tool-calls-breach.bru` — POST to `{{base_url}}/chat`; precondition note: user's toolCalls.count is at plan threshold (30 for homebody); assert status 429 and body `{ "error": "rate_limit_exceeded", "limit": "tool_calls_per_day", "limit_value": 30 }`
- [x] T020 [P] [US3] Create `kebi-config/bruno/rate-limit/default-plan-fallback.bru` — POST to `{{base_url}}/chat` with a token whose `public_metadata` has no `plan` field; exhaust homebody's `sessions_per_day: 3`; assert 429 with `"limit_value": 3` confirming default plan was applied

**Checkpoint**: Counter updates fire on every response; tool-call cap and default-plan fallback are testable

---

## Phase 6: User Story 4 — Day rollover and logout reset (Priority: P2)

**Goal**: Daily counters reset at UTC midnight when the stored date ≠ today UTC; `turns_per_session` resets to 0 when Clerk fires `session.ended`; neither logout nor day rollover resets the wrong counters.

**Independent Test (rollover)**: Pre-set `sessions.date` and `toolCalls.date` to yesterday's UTC date; send a message; verify the guard passes (counters reset to 0) and the request forwards normally.  
**Independent Test (logout)**: After accumulating turns, trigger `session.ended` webhook; verify `turns` is 0 and `sessions_per_day` / `tool_calls_per_day` are unchanged.

### Implementation

- [x] T021 [US4] Update `services/api/src/webhooks/clerk.webhook.ts` — inject `RateLimitService` in constructor; add a handler branch for `event.type === 'session.ended'`: extract `userId = event.data?.user_id as string`; call `rateLimitService.resetTurns(userId)`; log the reset (after T008, T012)
- [x] T022 [P] [US4] Create `kebi-config/bruno/rate-limit/day-rollover.bru` — precondition note: sessions.date and toolCalls.date set to yesterday UTC; POST to `{{base_url}}/chat`; assert status 200 (not 429) confirming counters were reset by the stale-date check
- [x] T023 [P] [US4] Create `kebi-config/bruno/rate-limit/logout-reset.bru` — sequence: (1) accumulate turns; (2) POST Clerk webhook event `session.ended` to `{{base_url}}/webhooks/clerk`; (3) POST chat; assert turns reset (session_started: true expected on next new session) while sessions/toolCalls daily counts are unchanged

**Checkpoint**: All four user stories independently verifiable; full rate-limit system complete

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T024 Run `pnpm nx build api` — TypeScript clean build; zero errors
- [x] T025 Run `pnpm nx test api` — all unit tests pass including `rate-limit.service.spec.ts`
- [x] T026 Run `pnpm nx lint` — no ESLint violations; no inline disables
- [x] T027 [P] Verify `libs/shared` build: `pnpm nx build shared` — `PlanTier`, `AuthUser`, `ChatResponseDto` extension compile cleanly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundation)**: Depends on Phase 1; **BLOCKS all user story phases**
- **Phase 3 (US1)**: Depends on Phase 2 — no other story dependency
- **Phase 4 (US2)**: Depends on Phase 2 — can run after Phase 2 (does not depend on Phase 3)
- **Phase 5 (US3)**: Depends on Phase 4 — modifies the same `chat.service.ts` file; must run after T016
- **Phase 6 (US4)**: Depends on Phase 2 — independent of US1/US2/US3
- **Phase 7 (Polish)**: Depends on all phases complete

### Within-Phase Task Dependencies

**Phase 2**:
- T002 and T003 are parallel (different sections of same file — take care with concurrent edits; write sequentially if solo)
- T004 depends on T002
- T006 and T007 depend on T002 and T004
- T008 depends on T005 (reads config shape)
- T009 depends on T008
- T010 depends on T008
- T011 and T012 depend on T010 (parallel with each other)

**Phase 5**:
- T018 depends on T016 (same file, same method — edit sequentially)

### Parallel Opportunities

```
Phase 2 parallel group A (safe to start together):
  T002 — libs/shared/src/lib/types.ts (PlanTier + AuthUser)
  T005 — services/api/config/app.yaml

Phase 2 parallel group B (after T002 + T004 done):
  T006 — clerk.middleware.ts
  T007 — ai-enabled.guard.ts

Phase 2 parallel group C (after T010 done):
  T011 — chat.module.ts
  T012 — app.module.ts

Phase 3, 4, 6 (after Phase 2 complete — independent stories):
  Phase 3 (US1): T013 → T014 → T015
  Phase 4 (US2): T016 → T017
  Phase 6 (US4): T021 → T022, T023

Phase 7 parallel group:
  T024, T025, T026, T027
```

---

## Implementation Strategy

### MVP (User Story 1 — Session Cap)

1. Phase 1: T001
2. Phase 2: T002 → T004 → T006, T007 → T005 → T008 → T010 → T011, T012
3. Phase 3: T013 → T014 → T015
4. **STOP**: Run Bruno sessions-breach test — if 429 returned with correct body, MVP is live

### Incremental Delivery

1. MVP (Phase 1–3): Session cap working → verifiable with Bruno T015
2. Add US2 (Phase 4): Turns accumulate → verifiable with Bruno T017
3. Add US3 (Phase 5): Tool-call counters update from response → verifiable with Bruno T019, T020
4. Add US4 (Phase 6): Day rollover + logout → verifiable with Bruno T022, T023
5. Polish (Phase 7): Full build + test + lint pass

---

## Notes

- T002 and T003 both write to `libs/shared/src/lib/types.ts` — if working solo, write them as a single edit
- T016 and T018 both modify `services/api/src/chat/chat.service.ts` — write sequentially; T018 adds logic after the `aiClient.chat()` call that T016 doesn't touch yet
- Day-reset uses `new Date().toISOString().slice(0,10)` — never `getDate()`/`getMonth()`/`toLocaleDateString()` (see data-model.md timezone rule)
- `session_started` check in ChatService: `if (response.session_started)` — the field is `true | absent`, never `false`; this check handles both cases correctly
- Bruno tests require `DEV_BYPASS_TOKEN` set in `.env.local` and NestJS running on port 3333
- New Bruno collection folder: `kebi-config/bruno/rate-limit/`
