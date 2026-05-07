# Tasks: Home Page Infrastructure, Flow 2 & Flow 9

**Branch**: `001-home-infra-flow2-flow9`
**Input**: `specs/001-home-infra-flow2-flow9/` — plan.md, spec.md, data-model.md, research.md, contracts/
**Tests**: Not requested — no test tasks generated.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Parallelizable — different files, no dependency on an in-progress sibling task
- **[Story]**: US1 = Consult Flow | US2 = Taste Profile | US3 = Hydration | US4 = Infrastructure

---

## Phase 1: Setup

**Purpose**: Install new dependencies and create directory scaffolding.

- [x] T001 Install `zustand@^5` and `zod@^3` in `apps/web` via `pnpm add zustand zod --filter apps/web`
- [x] T002 Create empty directory scaffolding: `apps/web/src/flows/`, `apps/web/src/flows/consult/`, `apps/web/src/store/`, `apps/web/src/lib/`, `apps/web/src/storage/`, `apps/web/src/constants/`, `apps/web/src/components/home/`, `apps/web/src/components/layout/`

---

## Phase 2: Foundational — Infrastructure & Cleanup (US4)

**Purpose**: Shared types, storage layer, classifier, chat client, Flow Registry scaffold, Zustand store skeleton, illustration aliases, dead code deletion, i18n restructure, ChatInput simplification. ALL of this must be complete before any user story phase begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

**Goal (US4)**: All shared infrastructure in place; deleted components cause zero lint errors; `NEXT_PUBLIC_CHAT_FIXTURES=true` causes no network calls; `NEXT_PUBLIC_DEV_SAVED_COUNT` env var is wired but not yet visually verifiable (that comes in US3).

**Independent Test (US4)**: `pnpm nx lint web` passes with zero errors after all deletions. `NEXT_PUBLIC_CHAT_FIXTURES=true` is readable from the chat client stub. `classifyIntent('tiktok.com/video/123')` returns `'save'`; `classifyIntent('that ramen place I saved')` returns `'recall'`; `classifyIntent('cheap dinner nearby')` returns `'consult'`.

- [x] T003 [US4] Update `libs/shared/src/lib/types.ts`: add `ClientIntent`, `ChatResponseType` (named union), `ReasoningStep`, `ConsultPlace`, `ConsultResponseData`, `RecallItem`, `RecallResponseData`, `SavedPlaceStub`; narrow `ChatResponseDto.data` from `Record<string,unknown>|null` to the typed union; export all new types from `libs/shared/src/index.ts`
- [x] T004 [P] [US4] Create `apps/web/src/storage/saved-places-storage.ts`: export `getSavedPlaces(): SavedPlaceStub[]`, `getSavedPlaceCount(): number`, `appendSavedPlace(place: SavedPlaceStub): void`, `setSavedPlaces(places: SavedPlaceStub[]): void` — all wrapped in try/catch returning safe defaults on localStorage error
- [x] T005 [P] [US4] Create `apps/web/src/storage/taste-profile-storage.ts`: export `getTasteProfileConfirmed(): boolean`, `setTasteProfileConfirmed(): void` — localStorage key `kebi-app.tasteProfile`, try/catch with `false` default
- [x] T006 [P] [US4] Create `apps/web/src/storage/location-storage.ts`: export `getLocation(): { lat: number; lng: number } | null`, `setLocation(loc: { lat: number; lng: number } | null): void` — localStorage key `kebi-app.location`, try/catch with `null` default
- [x] T007 [P] [US4] Create `apps/web/src/constants/placeholders.ts`: export `TASTE_MATCH_ARC_PLACEHOLDER = 78` and `COMMUNITY_PROOF_COUNT = 142`
- [x] T008 [P] [US4] Create `apps/web/src/constants/home-suggestions.ts`: export `CONSULT_SUGGESTIONS: string[]` (3 suggestion strings) and `TASTE_CHIP_BANK: string[]` (`["Ramen lover", "Budget-friendly", "Night owl"]`)
- [x] T009 [US4] Create `apps/web/src/lib/classify-intent.ts`: export `classifyIntent(message: string): ClientIntent` — URL pattern → `'save'`; memory-language pattern (regex on "that", "I saved", "from TikTok/Instagram") → `'recall'`; everything else → `'consult'`; `'assistant'` deferred (classify as `'consult'` for now)
- [x] T010 [US4] Create `apps/web/src/lib/chat-client.ts`: define `ChatClientOptions` and `ChatClient` interface; implement `realChatClient(getToken)` posting to `POST /api/v1/chat` with `Authorization: Bearer` header; implement `chatClientFixtures` returning per-intent canned `ChatResponseDto` (consult fixture with 6 reasoning steps + primary + 2 alternatives; recall returns empty results; save returns extract-place resolved; assistant returns text reply); export `getChatClient(getToken): ChatClient` — returns fixture client when `NEXT_PUBLIC_CHAT_FIXTURES === 'true'`, real client otherwise
- [x] T011 [US4] Create `apps/web/src/flows/flow-definition.ts`: define `FlowId` union (`'consult' | 'recall' | 'save' | 'assistant' | 'clarification'`) and `FlowDefinition<TData>` interface (id, matches, phase, inputPlaceholderKey, schema, fixture, onResponse, Component) — import types from `@kebi-app/shared`
- [x] T012 [US4] Create `apps/web/src/flows/registry.ts`: export `FLOW_REGISTRY` with `satisfies Record<FlowId, FlowDefinition>` constraint — stub entries for all 5 FlowIds (no-op Component returning null, passthrough schema, empty onResponse); export `FLOW_BY_RESPONSE_TYPE` and `FLOW_BY_CLIENT_INTENT` lookup maps
- [x] T013 [US4] Create `apps/web/src/store/home-store.ts`: implement `useHomeStore` with full `HomePhase` (13 values), `HomeState` interface (all fields from data-model.md), and these actions fully implemented: `hydrate()` (reads all 3 storage modules, picks initial phase via four-way branch, respects `NEXT_PUBLIC_DEV_SAVED_COUNT` override in non-production), `init({ userId, getToken })`, `setUserId()`, `setLocation()` (persists to location-storage), `reset()` (returns to correct resting phase based on `savedPlaceCount`), `confirmTasteProfile()` (writes taste-profile-storage, flips to `'idle'`); stub remaining actions (`submit`, `submitRecall`, `openSaveSheet`, `confirmSave`, `dismissSaveSheet`, `dismissAssistantReply`, `incrementSavedCount`) — stubs throw `new Error('Not implemented: <action> — see sub-plan N')`; also export `HomeStoreApi` type
- [x] T014 [P] [US4] Update `apps/web/src/components/illustrations/kebi-app-illustrations.tsx`: add `KebiIdleWelcoming` export (maps to `kebi-app-home-input.svg` with `anim-bob`); add `KebiExcited` export (maps to `kebi-app-success.svg` with `anim-bounce`); remove exports whose only consumers are deleted components (`KebiStepListen`, `KebiStepRead`, `KebiStepMove`, `KebiStepCheck`, `KebiStepEvaluate`, `KebiStepComplete` — only used by `AgentResponseBubble`/`AgentStep`); keep all other existing exports unchanged
- [x] T015 [US4] Delete dead components — remove these files entirely: `apps/web/src/components/AgentResponseBubble.tsx`, `apps/web/src/components/AgentStep.tsx`, `apps/web/src/components/ChatMessage.tsx`, `apps/web/src/components/home-empty-state.tsx`, `apps/web/src/components/EmptyState.tsx`, `apps/web/src/components/LoadingState.tsx`, `apps/web/src/components/ReasoningBlock.tsx`, `apps/web/src/components/PlaceCard.tsx`; then fix all resulting import errors in `apps/web/src/app/[locale]/(main)/home/page.tsx` by removing the now-invalid imports (the page will be fully rewritten in T021)
- [x] T016 [US4] Restructure i18n: add `consult.*` namespace (header, steps, result, error, placeholder, skeleton), `tasteProfile.*` namespace (headline, subline, cta), and `home.idle.*` (headline, suggestions) to `apps/web/messages/en.json` and `apps/web/messages/he.json`; remove keys used exclusively by deleted components (`home.whereTo`, `home.moodPrompt`, `home.listening`, `home.tapToTalk`, `home.voicePrompt`); retain `home.suggestions.*` (reused by HomeIdle)
- [x] T017 [US4] Simplify `apps/web/src/components/ChatInput.tsx`: remove `value`/`setValue` local state; rename `onSend` prop → `onSubmit`; wire submit handler to call `onSubmit(value.trim())` directly (store.submit is passed as onSubmit from the page); keep all other state (voice mode, speaker, paste items), all markup, and all styling unchanged

**Checkpoint (US4)**: `pnpm nx lint web` passes. Imports compile. `classifyIntent` unit-testable in isolation. Storage modules readable in browser DevTools.

---

## Phase 3: User Story 3 — Phase Hydration & Dev Override (Priority: P1)

**Goal**: The home page shell renders correctly for all four resting phases. `NEXT_PUBLIC_DEV_SAVED_COUNT` forces any phase. No flash of wrong content on load.

**Independent Test**: Set `NEXT_PUBLIC_DEV_SAVED_COUNT` to 0, 3, 5, and 12; reload for each value; confirm the store's `phase` value resolves to `cold-0`, `cold-1-4`, `taste-profile`/`idle` (per `tasteProfileConfirmed`), and `idle` respectively. With `=5` and no `tasteProfile` localStorage key, `TasteProfileCelebration` renders (placeholder — built in US2). With `=0`, `HomeIdle` renders. With `=12`, `HomeIdle` renders.

- [x] T018 [P] [US3] Create `apps/web/src/components/home/HomeIdle.tsx`: render `KebiIdleWelcoming` illustration, `t('home.idle.headline')` heading, three suggestion chips from `CONSULT_SUGGESTIONS` calling `onSuggestionClick(text)` prop; all spacing/text using logical properties and semantic tokens; `Props: { onSuggestionClick: (text: string) => void }`
- [x] T019 [P] [US3] Create `apps/web/src/components/home/HomeGreeting.tsx`: reads nothing from store directly — accepts `phase: HomePhase` prop; renders a greeting text when phase is `idle`, `cold-0`, or `cold-1-4`; renders `null` for all other phases; use `useTranslations()` for greeting string
- [x] T020 [P] [US3] Create `apps/web/src/components/layout/ClarificationHint.tsx`: accepts `message: string | null` prop; renders `null` when message is null; renders muted italic single-line hint with 150 ms fade-in on mount when non-null; positioned above input bar by the page layout (not self-positioned)
- [x] T021 [US3] Rewrite `apps/web/src/app/[locale]/(main)/home/page.tsx`: three-layer fixed layout (NavBar / flex-1 scrollable message area / always-mounted input bar); `useEffect` calls `store.hydrate()` then `store.init({ userId, getToken })` (Clerk `useAuth()`); `useMemo` content block — resting-phase switch renders `HomeIdle` (idle), placeholder `<div>` for cold-0/cold-1-4/taste-profile/error (components built in later phases/sub-plans), `null` for hydrating; flow-state branch delegates to `FLOW_REGISTRY[store.activeFlowId].Component` when `activeFlowId` is set; `ClarificationHint` wired above input bar (always present, renders null when no message); `HomeGreeting` wired with current phase; `ChatInput` wired with `onSubmit={store.submit}` and `placeholder={t(placeholderKey)}`; renders nothing (null) until `store.hydrated === true`

**Checkpoint (US3)**: `NEXT_PUBLIC_DEV_SAVED_COUNT` override fully functional. `pnpm nx dev web` loads without errors. No flash of wrong phase on first paint.

---

## Phase 4: User Story 1 — Consult Flow (Flow 2) (Priority: P1) 🎯 MVP

**Goal**: Submit a consult query → six-step thinking animation → result card with primary + 2 alternatives. Animation and fetch race correctly — card never reveals before 4100 ms.

**Independent Test**: With `NEXT_PUBLIC_CHAT_FIXTURES=true` and `NEXT_PUBLIC_DEV_SAVED_COUNT=12`, type any query and submit. Confirm: thinking steps appear sequentially; skeleton card appears ~2200 ms in; result card reveals only after animation completes (~4100 ms); two alternative cards slide in 400 ms later; `pnpm nx build web` passes.

- [x] T022 [P] [US1] Create `apps/web/src/flows/consult/consult.constants.ts`: export `FLOW_2_STEPS` array (6 items with `key` and `i18nKey: 'consult.steps.*'`), `STEP_OFFSETS = [0, 700, 1500, 2300, 3000, 3700]` ms, `STEP_DURATIONS = [600, 700, 700, 600, 600, 400]` ms, `ANIMATION_COMPLETE_MS = 4100`, `SKELETON_APPEARS_MS = 2200`
- [x] T023 [P] [US1] Create `apps/web/src/flows/consult/consult.schema.ts`: export `ConsultResponseDataSchema` (Zod schema that validates `ConsultResponseData` shape — primary, alternatives array, reasoning_steps array, optional context_chips)
- [x] T024 [P] [US1] Create `apps/web/src/flows/consult/consult.fixtures.ts`: export `consultFixture(req: ChatRequestDto): Promise<ChatResponseDto>` returning a realistic canned response with `type: 'consult'`, 6 `reasoning_steps` with real summaries, 1 primary place (name, address, reasoning, source, photos), 2 alternatives
- [x] T025 [US1] Create `apps/web/src/flows/consult/ConsultThinking.tsx`: `Props: { query: string; contextPills: string[]; reasoningSteps: ReasoningStep[]; onAnimationComplete: () => void }`; single `useEffect` schedules 6 `setTimeout`s per `STEP_OFFSETS`/`STEP_DURATIONS`; cleanup calls `clearTimeout` on all; per-step row: `translateY(8px→0) + opacity 0→1, 200ms ease`; active step dot: gold border + pulsing inner dot (1.1s CSS keyframe); completed dot: gold border + checkmark, 100ms fade; skeleton card fades in at `SKELETON_APPEARS_MS` (110px gray block + 3 shimmer bars, `opacity 0.5→1→0.5, 1400ms infinite`); `onAnimationComplete` fires at `ANIMATION_COMPLETE_MS`; header: small-caps `t('consult.header.thinkingAbout')` + query + gold context pills (prefer `contextPills` prop, fall back to parsing `reasoningSteps[0].summary` on `·`, render nothing if both empty); sub-labels from `reasoningSteps[i].summary` — empty string until populated, subscribe to store and fade in 150ms when array populates; all spacing uses logical properties
- [x] T026 [P] [US1] Create `apps/web/src/flows/consult/TasteMatchArc.tsx`: 44×44px SVG radial progress arc, gold stroke `#c8890a` (with `TODO: tokenize` comment), `stroke-dasharray` trick, value from `TASTE_MATCH_ARC_PLACEHOLDER`; renders top-right of the primary card header (positioned by parent)
- [x] T027 [P] [US1] Create `apps/web/src/flows/consult/CommunityProofLine.tsx`: single italic muted line using `t('consult.result.communityProof', { count: COMMUNITY_PROOF_COUNT })`; add `consult.result.communityProof` i18n key to en.json/he.json
- [x] T028 [US1] Create `apps/web/src/flows/consult/PrimaryResultCard.tsx`: `Props: { result: ConsultPlace; children?: React.ReactNode }`; 16:9 hero photo at 110px tall (fallback gray bg if no photo); place name overlay; context pills row (cuisine · price · distance — render only non-null fields); reasoning block with 2px gold left border (`#c8890a`) + warm bg (`#f5ead8`) with `TODO: tokenize` comments; source attribution below reasoning (`t('consult.result.source.saved')` / `t('consult.result.source.discovered')`); action row (Directions, Call, Share, Menu buttons — `t('consult.result.actions.*')`); entry animation `scale 0.95→1.0, 300ms spring`; all spacing logical properties; accepts `children` for `TasteMatchArc` + `CommunityProofLine` slots
- [x] T029 [US1] Create `apps/web/src/flows/consult/AlternativeCard.tsx`: `Props: { alt: ConsultPlace }`; small 1:1 photo; place name; one-line subline; entry animation `translateY(12px→0) + opacity 0→1, 400ms ease` (delay applied by parent); no reasoning, no actions; logical properties
- [x] T030 [US1] Create `apps/web/src/flows/consult/ConsultResult.tsx`: compose `ResultHeader` (inline — `t('consult.result.header')` + gold check icon), `PrimaryResultCard` with `TasteMatchArc` and `CommunityProofLine` as children, `AlternativesDivider` (inline — italic `t('consult.result.divider')`), 2-column `AlternativesGrid` with `AlternativeCard` items staggered 50ms delay each; reads `result: ConsultResponseData` from `useHomeStore()`
- [x] T031 [US1] Create `apps/web/src/flows/consult/index.ts`: export `consultFlow: FlowDefinition<ConsultResponseData>` with `id: 'consult'`, `matches: { clientIntent: 'consult', responseType: 'consult' }`, `phase: 'thinking'`, `inputPlaceholderKey: 'consult.placeholder'`, `schema: ConsultResponseDataSchema`, `fixture: consultFixture`, `onResponse: (res, store) => { store.setPendingResult(res.data as ConsultResponseData); store.tryRevealResult(); }`, `Component: ConsultDispatcher` (inline component in same file that reads `store.phase` — renders `ConsultThinking` when phase is `thinking`, `ConsultResult` when phase is `result`)
- [x] T032 [US1] Replace consult stub in `apps/web/src/flows/registry.ts` with the real `consultFlow` import from `./consult`
- [x] T033 [US1] Implement `submit()` and race actions in `apps/web/src/store/home-store.ts`: replace the `submit` stub with the full dispatcher (classify intent → pre-route via `FLOW_BY_CLIENT_INTENT` → set phase + activeFlowId → fire fetch via `getChatClient(getToken)` with `AbortController` → on success: handle clarification orthogonally (set `clarificationMessage`, return) → resolve final flow via `FLOW_BY_RESPONSE_TYPE` → validate with `finalFlow.schema.safeParse` → call `finalFlow.onResponse`; on error: categorize and set error phase); implement `setPendingResult(data)`, `tryRevealResult()` (no-ops unless both `animationComplete` and `fetchComplete` — then sets `result` + flips to `'result'`), `markAnimationComplete()` (sets flag + calls `tryRevealResult`); implement `fetchComplete` flag set after fetch resolves
- [x] T034 [P] [US1] Create `apps/web/src/components/home/ConsultError.tsx`: `Props: { error: HomeState['error']; onTryAgain: () => void }`; renders `KebiIdleWelcoming` illustration; headline from `t('consult.error.<category>.headline')`; body from `t('consult.error.<category>.body')`; gold "Try again" button calling `onTryAgain`; all logical properties

**Checkpoint (US1)**: Fixture-backed consult end-to-end works. Result card never reveals before 4100ms. Build passes.

---

## Phase 5: User Story 2 — Taste Profile Celebration (Flow 9) (Priority: P1)

**Goal**: User with 5+ saves (unconfirmed) sees celebration screen with taste chips. "Start exploring" persists confirmation and transitions to idle. Reload never shows celebration again.

**Independent Test**: `NEXT_PUBLIC_DEV_SAVED_COUNT=5`, clear `kebi-app.tasteProfile` from localStorage, reload — `TasteProfileCelebration` renders with 3 chips. Toggle chip states. Tap "Start exploring" → phase flips to `idle`, `HomeIdle` renders. Reload with same `DEV_SAVED_COUNT=5` → `idle` renders directly (celebration gone).

- [x] T035 [US2] Create `apps/web/src/components/home/TasteProfileCelebration.tsx`: `Props: { chips: string[]; onStartExploring: () => void }`; renders `KebiExcited` illustration; headline `t('tasteProfile.headline')`; subline `t('tasteProfile.subline')`; 3 chips with local `pending | confirmed | dismissed` state per chip — confirmed: bg `#d8ecc8` / fg `#3a6018` / border `#b0d090` inline hex with `TODO: tokenize`; dismissed: 25% opacity; pending: default muted style; gold "Start exploring" CTA button calling `onStartExploring` — chip state is local only, not persisted; all spacing logical properties
- [x] T036 [US2] Wire `TasteProfileCelebration` into `apps/web/src/app/[locale]/(main)/home/page.tsx`: replace the `taste-profile` phase placeholder `<div>` with `<TasteProfileCelebration chips={TASTE_CHIP_BANK} onStartExploring={store.confirmTasteProfile} />`

**Checkpoint (US2)**: Flow 9 lifecycle complete. `confirmTasteProfile()` was already implemented in T013 — T036 is the wiring only.

---

## Phase 6: Polish & Verification

**Purpose**: Final lint, build, and manual phase verification.

- [x] T037 Run `pnpm nx lint web` and fix any remaining lint errors across all modified files
- [ ] T038 [P] Manual phase verification: test `NEXT_PUBLIC_DEV_SAVED_COUNT` at 0, 3, 5 (unconfirmed), 5 (confirmed), 12 — confirm correct phase renders for each; confirm `hydrating` phase shows nothing then resolves
- [ ] T039 [P] Manual consult verification: `NEXT_PUBLIC_CHAT_FIXTURES=true` + `NEXT_PUBLIC_DEV_SAVED_COUNT=12` — submit a consult query; confirm 6-step animation, skeleton at ~2200ms, result reveals after ~4100ms, alternatives slide in
- [x] T040 Run `pnpm nx build web` — confirm zero build errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational/US4)**: Requires Phase 1 complete — blocks all user story phases
- **Phase 3 (US3 — Hydration)**: Requires Phase 2 complete
- **Phase 4 (US1 — Consult)**: Requires Phase 3 complete (home page shell must exist)
- **Phase 5 (US2 — Taste Profile)**: Requires Phase 2 complete; can start in parallel with Phase 4 after Phase 2 is done (T035 has no dependency on US1 tasks)
- **Phase 6 (Polish)**: Requires Phases 4 and 5 complete

### Within-Phase Dependencies

**Phase 2**:
- T003 must complete before T009–T013 (shared types needed by storage, classifier, client, store)
- T004–T008 can run in parallel after T003
- T011 must complete before T012 (registry needs FlowDefinition interface)
- T012 must complete before T013 (store needs registry)
- T013 must complete before T015 (store must exist before page is broken by deletions)
- T014–T017 can run in parallel after T013

**Phase 4**:
- T022–T024 can run in parallel (constants, schema, fixtures are independent)
- T025 requires T022 (constants)
- T026–T027 can run in parallel (TasteMatchArc and CommunityProofLine are independent)
- T028 requires T026 + T027 (PrimaryResultCard composes them)
- T029 can run in parallel with T028
- T030 requires T028 + T029
- T031 requires T025 + T030 (ConsultDispatcher needs both thinking and result)
- T032 requires T031
- T033 requires T032 (submit() needs registry to be populated)
- T034 can run in parallel with T025–T032

### Parallel Opportunities

```
Phase 2 parallel batch A (after T003):
  T004 saved-places-storage.ts
  T005 taste-profile-storage.ts
  T006 location-storage.ts
  T007 classify-intent.ts
  T008 chat-client.ts
  T009 constants/placeholders.ts
  T010 constants/home-suggestions.ts
  T011 flow-definition.ts

Phase 2 parallel batch B (after T013):
  T014 illustration aliases
  T016 i18n restructure
  T017 ChatInput simplification

Phase 3 parallel batch (no inter-dependencies):
  T018 HomeIdle.tsx
  T019 HomeGreeting.tsx
  T020 ClarificationHint.tsx

Phase 4 parallel batch A (no inter-dependencies):
  T022 consult.constants.ts
  T023 consult.schema.ts
  T024 consult.fixtures.ts

Phase 4 parallel batch B (after T022):
  T025 ConsultThinking.tsx
  T026 TasteMatchArc.tsx
  T027 CommunityProofLine.tsx
  T034 ConsultError.tsx

Phase 5 can run in parallel with Phase 4 batch A/B:
  T035 TasteProfileCelebration.tsx
```

---

## Implementation Strategy

### MVP (User Stories 3 + 1)

1. Complete Phase 1 + 2 → foundation and clean codebase
2. Complete Phase 3 (US3) → home page shell with correct hydration
3. Complete Phase 4 (US1) → consult flow end-to-end with fixtures
4. **STOP and VALIDATE** with `NEXT_PUBLIC_CHAT_FIXTURES=true`
5. Phase 5 (US2 — taste profile) is a small add-on, run after

### Incremental Delivery

1. Phase 1 + 2 → zero lint errors, dead code gone ✓
2. Phase 3 → home page shell, hydration verified ✓
3. Phase 4 → consult flow working fixture-backed ✓
4. Phase 5 → taste profile celebration ✓
5. Phase 6 → clean build ✓

---

## Notes

- Flow numbers (Flow 2, Flow 9) appear only in comments and spec docs — never in i18n keys, variable names, or file names. Use `consult` and `tasteProfile`.
- Inline hex colors (`#c8890a`, `#f5ead8`, `#d8ecc8`, `#3a6018`, `#b0d090`) must have `TODO: tokenize` comments — do not use raw Tailwind colors.
- All layout spacing must use logical properties (`ms-`, `me-`, `ps-`, `pe-`, `text-start`, `border-s`, etc.).
- The `submit()` stub in T013 throws `NotImplementedError` — this is intentional and replaced in T033.
- T015 (dead code deletion) will break `home/page.tsx` temporarily — T021 fixes it in the same phase.
- `NEXT_PUBLIC_DEV_SAVED_COUNT` is ignored silently in production (`NODE_ENV === 'production'`).
