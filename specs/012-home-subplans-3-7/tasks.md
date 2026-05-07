# Tasks: Home Page Sub-plans 3–7

**Input**: Design documents from `/specs/012-home-subplans-3-7/`  
**Branch**: `012-home-subplans-3-7`  
**Tests**: Not requested — no test tasks generated.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: User story this task belongs to (US1–US6)

---

## Phase 1: Setup

**Purpose**: Verify environment and confirm sub-plans 1–2 foundation is in place.

- [ ] T001 Verify branch is `012-home-subplans-3-7` and sub-plans 1–2 components exist (`apps/web/src/components/home/HomeIdle.tsx`, `apps/web/src/store/home-store.ts`, `apps/web/src/flows/consult/`)
- [ ] T002 Confirm `apps/web/src/flows/flow-definition.ts` has all `HomePhase` values needed (`save-sheet`, `save-duplicate`, `save-snackbar`, `recall`, `assistant-reply`, `cold-0`, `cold-1-4`) — add any missing ones

---

## Phase 2: Foundation (Blocking Prerequisites)

**Purpose**: Shared types, i18n, storage, store skeleton, and fixture infrastructure that MUST be complete before any user story phase begins.

**⚠️ CRITICAL**: All user story phases depend on this phase completing.

### Shared types

- [ ] T003 [P] Add `has_more: boolean` to `RecallResponseData`, `thumbnail_url?: string` to `RecallItem`, `source_url: string | null` + `thumbnail_url?: string` to `SavedPlaceStub` in `libs/shared/src/lib/types.ts`
- [ ] T004 [P] Add `ExtractPlaceData` interface and `SaveSheetPlace` interface to `libs/shared/src/lib/types.ts` (shapes defined in `specs/012-home-subplans-3-7/data-model.md` §1)

### Storage extension

- [ ] T005 [P] Add `getSavedPlaces(): SavedPlaceStub[]` and `appendSavedPlace(place: SavedPlaceStub): void` to `apps/web/src/storage/saved-places-storage.ts` using key `kebi-app.savedPlaces` (JSON array, try/catch no-op)

### Store state extension

- [ ] T006 Add `preSavePhase: HomePhase | null`, `saveSheetMessage: string | null`, `recallQuery: string | null`, `recallBreadcrumb: boolean` fields to `HomeState` interface and initial state in `apps/web/src/store/home-store.ts`
- [ ] T007 Extend `ThreadEntry` union in `apps/web/src/store/home-store.ts`: add `dismissed?: boolean` to `clarification` entry; add `| { id: string; role: 'assistant'; type: 'assistant'; message: string; dismissed?: boolean }` variant (depends on T003)
- [ ] T008 Implement `openSaveSheet(message)` in `apps/web/src/store/home-store.ts`: capture `preSavePhase = get().phase`, set `phase: 'save-sheet'`, `saveSheetMessage: message`, `saveSheetStatus: 'pending'` (depends on T006)
- [ ] T009 Implement `confirmSave()` in `apps/web/src/store/home-store.ts`: set `saveSheetStatus: 'saving'`, call chat client with `saveSheetMessage`, on `status:'resolved'` call `incrementSavedCount` then set `phase:'save-snackbar'`, on `status:'duplicate'` set `phase:'save-duplicate'` + `saveSheetOriginalSavedAt`, on error set `saveSheetStatus:'error'` (depends on T008, T004)
- [ ] T010 Implement `dismissSaveSheet()` in `apps/web/src/store/home-store.ts`: restore `phase = preSavePhase ?? pickRestingPhase(savedPlaceCount, tasteProfileConfirmed)`, clear `preSavePhase`, `saveSheetPlace`, `saveSheetMessage`, `saveSheetStatus: 'pending'` (depends on T008)
- [ ] T011 Implement `incrementSavedCount(place)` in `apps/web/src/store/home-store.ts`: call `incrementSavedPlaceCount()` and `appendSavedPlace(place)` from storage, update `savedPlaceCount` in store (depends on T005)
- [ ] T012 Implement `submitRecall(message)` in `apps/web/src/store/home-store.ts`: set `recallQuery: message`, `phase:'recall'`, `recallResults: null`, `recallBreadcrumb: false`; start 600ms timer → if still in-flight set `recallBreadcrumb: true`; on response set `recallResults`, `recallHasMore`; cancel timer on completion (depends on T006, T007)
- [ ] T013 Implement `dismissAssistantReply()` in `apps/web/src/store/home-store.ts`: map `thread`, find last entry with `role:'assistant'` and (`type:'assistant'` or `type:'clarification'`) where `dismissed` is not `true`, return `{ ...entry, dismissed: true }` for that entry, all others unchanged — no splice (depends on T007)

### Fetch layer — per-intent fixture files

- [ ] T014 [P] Create `apps/web/src/flows/recall/recall.fixtures.ts`: export `recallFixture` function keyed on query strings — `"that ramen place from TikTok"` → 2 results + `has_more:true`; `"the cafe near Sukhumvit"` → 3 results + `has_more:false`; `"Japanese spot in Tokyo"` → 1 result + `has_more:true`; unknown → `{ results:[], total:0, has_more:false }`. Delay: 400ms.
- [ ] T015 [P] Create `apps/web/src/flows/save/save.fixtures.ts`: export `saveFixture` function keyed on message — `"tiktok.com/@foodie/ramen123"` → `status:'resolved'` confidence 0.92; `"Paste Bangkok restaurant"` → `status:'resolved'` confidence 0.78; `"Fuji Ramen Bangkok"` → `status:'duplicate'` + `original_saved_at:"2026-02-12"`; unknown → `status:'resolved'` confidence 0.35 + `requires_confirmation:true`. Delay: 800ms. (depends on T004)
- [ ] T016 [P] Create `apps/web/src/flows/assistant/assistant.fixtures.ts`: export `assistantFixture` — `"clarify me"` → `{ type:'clarification', message:"Could you add a cuisine or area so I can narrow it down?", data:null }`; all other messages → `{ type:'assistant', message:"I'm not sure how to help with that yet — try asking for a place or pasting a link.", data:null }`. Delay: 300ms.
- [ ] T017 Update `apps/web/src/lib/chat-client.ts`: import `recallFixture`, `saveFixture`, `assistantFixture`; update fixture client to dispatch by intent with per-intent delays (consult 2500ms, recall 400ms, save 800ms, assistant 300ms); remove inline mock data for non-consult intents (depends on T014, T015, T016)

### i18n keys

- [ ] T018 [P] Add all flow3/flow4/flow7/flow8/flow11 i18n keys to `apps/web/messages/en.json` — full list in `specs/012-home-subplans-3-7/spec.md` §i18n (lines 182–219)
- [ ] T019 [P] Add same keys with Hebrew translations to `apps/web/messages/he.json` (parallel with T018)
- [ ] T020 [P] Add `illustrations.*` alt-text keys to both `apps/web/messages/en.json` and `apps/web/messages/he.json` (`illustrations.auth`, `illustrations.idleWelcoming`, `illustrations.raining`, `illustrations.encouraging`, `illustrations.excited`, `illustrations.knowing`, `illustrations.welcomeBack`, `illustrations.listen`, `illustrations.empty`, `illustrations.addPlace`, `illustrations.addPlaceProcessing`, `illustrations.addPlaceSuccess`)

**Checkpoint**: Foundation ready — `pnpm nx build web` must pass with zero TypeScript errors before proceeding.

---

## Phase 3: User Story 6 — Illustration System Registry (Priority: P2) 🔨 Prerequisite for US1 & US2

**Goal**: Replace scattered named illustration exports with a typed registry and single `<Illustration />` component. Required before cold-start components can use illustrations.

**Independent Test**: `pnpm nx build web` zero errors; `grep -r "KebiHomeInput\|KebiSplash\|KebiSuccess\|KebiPlaceDetail\|KebiHoverPeek\|KebiStepComplete" apps/web/src/` returns zero results.

- [ ] T021 [US6] Create `apps/web/src/components/illustrations/registry.ts` with `IllustrationId` union, `AnimationClass` union, `IllustrationDefinition` interface, and `ILLUSTRATION_REGISTRY` const — full definition in `specs/012-home-subplans-3-7/data-model.md` §5 (depends on T020)
- [ ] T022 [US6] Create `apps/web/src/components/illustrations/Illustration.tsx`: looks up `ILLUSTRATION_REGISTRY[id]`, renders `<img>` with `t(def.altKey)`, applies animation class when `animate !== false`, applies `motion-reduce:!animate-none` unconditionally (depends on T021)
- [ ] T023 [US6] Rename SVGs via git mv: `kebi-app-home-input.svg` → `kebi-app-idle-welcoming.svg`, `kebi-app-splash.svg` → `kebi-app-raining.svg`, `kebi-app-success.svg` → `kebi-app-excited.svg`, `kebi-app-place-detail.svg` → `kebi-app-encouraging.svg`, `kebi-app-hover-peek.svg` → `kebi-app-knowing.svg`, `kebi-app-step-complete.svg` → `kebi-app-welcome-back.svg` in `apps/web/public/illustrations/`
- [ ] T024 [US6] Grep all consumers of old named exports from `kebi-app-illustrations.tsx` (`KebiAuth`, `KebiEmpty`, `KebiAddPlace`, `KebiAddPlaceProcessing`, `KebiAddPlaceSuccess`) and update each call site to use `<Illustration id="..." />` instead (depends on T022, T023)
- [ ] T025 [US6] Verify no remaining consumers of orphaned exports (`KebiHomeInput`, `KebiSplash`, `KebiSuccess`, `KebiPlaceDetail`, `KebiHoverPeek`, `KebiStepComplete`, `KebiResultCard`, `KebiProcessing`, `KebiError`) — then delete `apps/web/src/components/illustrations/kebi-app-illustrations.tsx` and the 8 orphaned SVG files from `apps/web/public/illustrations/` (depends on T024)

**Checkpoint**: Build passes, zero orphaned exports, all illustrations render via `<Illustration />`.

---

## Phase 4: User Story 3 — Save a Place via the Half-Sheet (Priority: P1) 🎯 MVP

**Goal**: User submits a URL/place name → save sheet slides up → user taps "Save to Kebi" → snackbar confirms. All four sheet states (pending, saving, duplicate, error) work correctly.

**Independent Test**: Submit `tiktok.com/@foodie/ramen123` → sheet opens with pending state → tap "Save to Kebi" → sheet shows saving spinner → snackbar slides in → auto-dismisses after 2800ms → previous phase restored. Submit `Fuji Ramen Bangkok` → duplicate state renders with knowing illustration + original save date.

- [ ] T026 [US3] Create `apps/web/src/flows/save/save.schema.ts` with `ExtractPlaceDataSchema` Zod schema (matches `ExtractPlaceData` from `libs/shared` — see `data-model.md` §4)
- [ ] T027 [US3] Create `apps/web/src/flows/save/SaveSheet.tsx`: fixed bottom panel `translate-y-full → translate-y-0` CSS transition duration-300; dark overlay `bg-[rgba(60,40,20,0.2)]` tap-outside calls `onDismiss`; handle bar + 52×52 thumbnail + Georgia serif place name + gold source badge + location text; status-driven body with all 4 states; `<Illustration id="knowing" />` in duplicate state; uses `SaveSheetPlace` props type (depends on T022, T018)
- [ ] T028 [US3] Create `apps/web/src/flows/save/SavedSnackbar.tsx`: fixed bottom sliding panel; `<Illustration id="welcome-back" className="size-8" />` inline; bold "Saved!" + subline from i18n; conditional gold italic "Taste signals updating." line when `showTasteSignals` prop is true; "Undo" gold link (no-op, console.warn TODO); `useEffect` 2800ms auto-dismiss calling `onDismiss` (depends on T022, T018)
- [ ] T029 [US3] Create `apps/web/src/flows/save/index.ts`: export `saveFlow` definition — `id:'save'`, `matches: { clientIntent:'save', responseType:'extract-place' }`, `phase:'save-sheet'`, `schema: ExtractPlaceDataSchema`, `fixture: saveFixture`, `onResponse` calls store save actions based on `status`, `Component: SaveSheet` (depends on T026, T015, T008, T009)
- [ ] T030 [US3] Update `apps/web/src/flows/registry.ts`: replace save stub with `saveFlow` import from `./save` (depends on T029)
- [ ] T031 [US3] Update `apps/web/src/app/[locale]/(main)/home/page.tsx`: mount `<SaveSheet />` at root layer (always rendered, driven by `phase === 'save-sheet' | 'save-duplicate'`); mount `<SavedSnackbar />` at root layer (driven by `phase === 'save-snackbar'`); pass `showTasteSignals={savedPlaceCount >= 1 && savedPlaceCount <= 4}` to snackbar; wire `onSave → store.confirmSave`, `onDismiss → store.dismissSaveSheet` (depends on T027, T028, T010, T011)

**Checkpoint**: Save flow fully functional in fixture mode. Snackbar restores previous phase after dismissal.

---

## Phase 5: User Story 1 — New User Cold-Start Zero (Priority: P1) 🎯 MVP

**Goal**: A user with zero saved places sees the cold-start zero onboarding screen with illustration, steps, and suggestion pills.

**Independent Test**: Set `localStorage.kebi-app.savedCount = '0'` (or clear it), reload → cold-start zero screen renders with Kebi illustration, headline, 3 numbered steps, paste hint, 2 suggestion pills. Tap a pill → text fills input bar but nothing submits.

- [ ] T032 [US1] Create `apps/web/src/components/home/ColdStartZero.tsx`: stateless component with `onSuggestionClick: (text: string) => void` prop; `<Illustration id="raining" className="size-24" />`; headline + subline from `t('flow7.headline')` / `t('flow7.subline')`; 3 numbered steps using `flow7.step1.*` / `flow7.step2.*` / `flow7.step3.*` i18n keys; muted paste hint `t('flow7.pasteHint')`; 2 suggestion pills from `CONSULT_SUGGESTIONS` constant calling `onSuggestionClick` on click (depends on T022, T018)
- [ ] T033 [US1] Update `apps/web/src/app/[locale]/(main)/home/page.tsx`: wire `phase === 'cold-0'` branch to render `<ColdStartZero onSuggestionClick={(text) => { /* fill input bar */ }} />`; remove the placeholder comment from sub-plans 1–2 (depends on T032)

**Checkpoint**: Cold-start zero renders correctly in isolation (`localStorage.kebi-app.savedCount` cleared).

---

## Phase 6: User Story 2 — Early User Cold-Start 1–4 (Priority: P1)

**Goal**: A user with 1–4 saved places sees their saves, a popular nearby card, and a starter-pack link. Saving a new place from this state shows the "Taste signals updating." snackbar addendum.

**Independent Test**: Set `localStorage.kebi-app.savedCount = '2'`, reload → cold-start 1–4 screen renders with encouraging illustration, saved place list (or placeholder row), popular card with dashed gold border, starter-pack link. Trigger a save → snackbar shows gold italic "Taste signals updating." line.

- [ ] T034 [US2] Create `apps/web/src/components/home/PopularNearbyCard.tsx`: wrapper component accepting `children: React.ReactNode`; renders "Popular right now" small-caps label above, `children`, then muted italic footnote `t('flow8.popularFootnote')` below; dashed gold border using `border border-dashed` with inline style `borderColor: '#c8a060'` (TODO: tokenize) (depends on T018)
- [ ] T035 [US2] Create `apps/web/src/components/home/ColdStartOneToFour.tsx`: accepts `savedPlaces: SavedPlaceStub[]`, `savedPlaceCount: number`, `onStarterPackClick: () => void`; `<Illustration id="encouraging" className="size-16" />`; headline + subline from `t('flow8.headline')` / `t('flow8.subline')`; compact saves list — map over `savedPlaces` (if empty show single placeholder row with `t('flow8.savedListEmpty')`); "What's good nearby" label; `<PopularNearbyCard>` wrapping a `<PrimaryResultCard>` seeded from the consult fixture; "City starter pack" link calling `onStarterPackClick` (depends on T034, T022, T003, T018)
- [ ] T036 [US2] Update `apps/web/src/app/[locale]/(main)/home/page.tsx`: wire `phase === 'cold-1-4'` branch to render `<ColdStartOneToFour savedPlaces={getSavedPlaces()} savedPlaceCount={store.savedPlaceCount} onStarterPackClick={() => console.warn('TODO: city starter pack')} />`; wrap `phase === 'result'` primary card in `<PopularNearbyCard>` when `store.savedPlaceCount < 5`; remove placeholder comment (depends on T035, T033, T005)

**Checkpoint**: Cold-1-4 renders correctly (`savedCount=2`). PopularNearbyCard visible on consult result when `savedCount < 5`.

---

## Phase 7: User Story 4 — Recall Flow (Priority: P2)

**Goal**: User types a memory fragment → recall results render as staggered cascade with provenance lines, mode-override pill, and empty-state footer.

**Independent Test**: Type "that ramen place from TikTok" → results list renders with 80ms staggered animation, "Found in your saves" header, mode-override pill, provenance lines. Type "unknown recall query" → empty-state footer with "Nothing else matches." card. Tap mode-override pill → consult re-submit fires.

- [ ] T037 [US4] Create `apps/web/src/flows/recall/recall.schema.ts` with `RecallResponseDataSchema` Zod schema (matches `RecallResponseData` including `has_more` — see `data-model.md` §4) (depends on T003)
- [ ] T038 [US4] Create `apps/web/src/flows/recall/ModeOverridePill.tsx`: gold pill with checkmark icon, text from `t('flow3.modeOverride')`, `onOverride` prop; calls `onOverride` on click (depends on T018)
- [ ] T039 [US4] Create `apps/web/src/flows/recall/RecallResults.tsx`: reads `recallResults`, `recallHasMore`, `recallQuery`, `recallBreadcrumb` from `store` prop; header shows `t('flow3.header')` or `t('flow3.breadcrumb')` muted text when `recallBreadcrumb === true`; renders `<ModeOverridePill onOverride={() => store.submit(store.recallQuery!, { forceIntent: 'consult' })} />`; maps results to rows: 38×38 thumbnail (fallback muted square div), bold place name, provenance line using ICU `t('flow3.provenance', {...})`; each row has `style={{ animationDelay: \`${i * 80}ms\` }}` and Tailwind `animate-[fadeSlideIn_200ms_linear_both]`; when `!recallHasMore && results.length <= 2` renders dashed-border footer card with `t('flow3.emptyFooter')` button that calls `store.submit(store.recallQuery!, { forceIntent: 'consult' })` (depends on T038, T014, T018, T012)
- [ ] T040 [US4] Create `apps/web/src/flows/recall/index.ts`: export `recallFlow` — `id:'recall'`, `matches: { clientIntent:'recall', responseType:'recall' }`, `phase:'recall'`, `schema: RecallResponseDataSchema`, `fixture: recallFixture`, `onResponse` sets `recallResults` + `recallHasMore` on store, `Component: RecallResults` (depends on T037, T039, T014)
- [ ] T041 [US4] Update `apps/web/src/flows/registry.ts`: replace recall stub with `recallFlow` import from `./recall` (depends on T040)
- [ ] T042 [US4] Update `apps/web/src/app/[locale]/(main)/home/page.tsx`: wire `phase === 'recall'` branch to render `<RecallResults store={store} />` (depends on T039, T041)

**Checkpoint**: Recall flow fully functional — staggered animation, breadcrumb, mode-override, empty state all working.

---

## Phase 8: User Story 5 — Assistant Reply & Clarification (Priority: P2)

**Goal**: Off-intent queries produce an assistant/clarification bubble in the thread that dismisses on tap or new query submission.

**Independent Test**: Type "clarify me" → clarification bubble appears in thread. Type any unknown → assistant reply bubble appears. Tap bubble → dismissed (renders nothing). Type new query → previous bubble dismissed before dispatch.

- [ ] T043 [US5] Create `apps/web/src/flows/assistant/assistant.fixtures.ts`: export `assistantFixture` function (same logic as T016 but as named export consumed by the flow definition) (depends on T016)
- [ ] T044 [US5] Create `apps/web/src/flows/assistant/index.ts`: export `assistantFlow` — `id:'assistant'`, `matches: { clientIntent:'assistant', responseType:'assistant' }`, `phase:'idle'`, `schema: z.object({ message: z.string() })`, `fixture: assistantFixture`, `onResponse` pushes `{ id: nextId(), role:'assistant', type:'assistant', message: res.message, dismissed: false }` to thread then sets phase to `pickRestingPhase(savedPlaceCount, tasteProfileConfirmed)`, `Component: () => null` (depends on T043, T013, T007)
- [ ] T045 [US5] Update `apps/web/src/components/home/AssistantBubble.tsx`: handle `entry.type === 'assistant'` (in addition to existing `'clarification'`); return `null` when `entry.dismissed === true`; ensure clarification entries also return `null` when `entry.dismissed === true` (depends on T007)
- [ ] T046 [US5] Update `apps/web/src/store/home-store.ts` `submit()` action: before dispatching a new query, call `dismissAssistantReply()` to clear any visible assistant/clarification bubble (depends on T013)
- [ ] T047 [US5] Update `apps/web/src/flows/registry.ts`: replace assistant stub with `assistantFlow` import from `./assistant`; ensure clarification flow `onResponse` also adds `dismissed: false` to thread entries (depends on T044)

**Checkpoint**: Type "clarify me" → bubble. Tap → gone. Type new query → bubble already dismissed before new dispatch.

---

## Phase 9: Polish & Cross-Cutting Verification

**Purpose**: Ensure all phases compose correctly, no regressions, RTL/i18n/accessibility requirements met.

- [ ] T048 [P] Create `apps/web/src/components/home/index.ts` barrel export: re-export `ColdStartZero`, `ColdStartOneToFour`, `PopularNearbyCard`, `HomeIdle`, `HomeGreeting`, `TasteProfileCelebration`, `ConsultError`, `AssistantBubble`, `UserBubble` (depends on T032, T035, T034)
- [ ] T049 Run `pnpm nx build web` — zero TypeScript errors (depends on all preceding tasks)
- [ ] T050 Run `pnpm nx lint web` — zero lint errors (depends on T049)
- [ ] T051 [P] Grep `apps/web/src/` for RTL violations (`\bpl-\|\bpr-\|\bml-\|\bmr-\|\btext-left\b\|\btext-right\b`) in all new/modified files — fix any found
- [ ] T052 [P] Grep `apps/web/src/` for orphaned illustration named exports (`KebiHomeInput\|KebiSplash\|KebiSuccess\|KebiPlaceDetail\|KebiHoverPeek\|KebiStepComplete`) — must return zero results (depends on T025)
- [ ] T053 [P] Grep `apps/web/src/components\|apps/web/src/flows` for hardcoded user-facing strings (any string literal that matches user-visible text not wrapped in `t(...)`) in new files — fix any found
- [ ] T054 Manual browser verification — cycle through all phases by manipulating localStorage per `specs/012-home-subplans-3-7/quickstart.md`: cold-0, cold-1-4, save flow (pending → saving → snackbar → phase restore), duplicate save, recall (results + empty-state + mode-override), assistant reply, clarification
- [ ] T055 [P] Manual browser verification — Hebrew locale (`/he/`) — reload in all phases, confirm no missing-key placeholders appear

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundation)**: Depends on Phase 1 — BLOCKS all user story phases
- **Phase 3 (US6 Illustrations)**: Depends on Phase 2 — blocks US1 (cold-start zero) and US2 (cold-1-4)
- **Phase 4 (US3 Save)**: Depends on Phase 2 — can run in parallel with Phase 3
- **Phase 5 (US1 Cold-0)**: Depends on Phase 3
- **Phase 6 (US2 Cold-1-4)**: Depends on Phase 3 + Phase 4 (needs save stubs)
- **Phase 7 (US4 Recall)**: Depends on Phase 2
- **Phase 8 (US5 Assistant)**: Depends on Phase 2
- **Phase 9 (Polish)**: Depends on all preceding phases

### User Story Dependencies

- **US6 (Illustrations)**: Foundational for US1, US2 — do first
- **US3 (Save, P1)**: Depends on Foundation only — can start after Phase 2
- **US1 (Cold-0, P1)**: Depends on US6 (illustrations)
- **US2 (Cold-1-4, P1)**: Depends on US6 (illustrations) + US3 (save — for `SavedPlaceStub` array)
- **US4 (Recall, P2)**: Depends on Foundation only
- **US5 (Assistant, P2)**: Depends on Foundation only

### Parallel Opportunities Within Phase 2

T003, T004, T005 can run in parallel (different files).
T014, T015, T016 can run in parallel (different fixture files).
T018, T019, T020 can run in parallel (i18n files — T018/T019 are same file so coordinate order).

---

## Parallel Execution Examples

### Phase 2 — Foundation (parallel groups)

```
Group A (parallel): T003, T004, T005
Then: T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013
Group B (parallel): T014, T015, T016 → T017
Group C (parallel): T018, T020 → T019
```

### Phase 4 + Phase 3 (parallel across stories)

```
Phase 3 (US6): T021 → T022 → T023 → T024 → T025
Phase 4 (US3): T026 → T027 → T028 → T029 → T030 → T031
(Both can run simultaneously after Phase 2)
```

### Phase 7 + Phase 8 (parallel across stories)

```
Phase 7 (US4): T037 → T038 → T039 → T040 → T041 → T042
Phase 8 (US5): T043 → T044 → T045 → T046 → T047
(Both can run simultaneously after Phase 2)
```

---

## Implementation Strategy

### MVP (Fastest Shippable Increment)

1. Phase 1: Setup ✓
2. Phase 2: Foundation (types, store, fixtures, i18n) ✓
3. Phase 4: US3 Save flow — core data-entry action ✓
4. Phase 5: US1 Cold-start zero — first impression ✓
5. **VALIDATE**: All three phases work end-to-end in fixture mode
6. Deploy/demo

### Incremental Delivery

1. Foundation + US3 Save + US1 Cold-0 → **MVP demo**
2. + US6 Illustration refactor → cleaner codebase, unblocks US2
3. + US2 Cold-1-4 → full cold-start experience complete
4. + US4 Recall → second core engagement loop
5. + US5 Assistant → graceful off-intent handling
6. Polish → production-ready

### Single Developer Sequence

Phase 1 → Phase 2 → Phase 4 → Phase 3 → Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9

---

## Notes

- `[P]` tasks operate on different files with no shared in-progress dependencies
- Each user story phase is a complete testable increment
- Commit after each phase checkpoint passes
- `pnpm nx build web` is the definitive type-check — run it after Phase 2 and after each subsequent phase
- The `#c8a060` border color in `PopularNearbyCard` is flagged as `TODO: tokenize` — leave as inline style for now
- The "Undo" binding in `SavedSnackbar` is a `console.warn('TODO: undo save')` no-op per spec
- The "City starter pack" link in `ColdStartOneToFour` is a `console.warn('TODO: city starter pack')` no-op per spec
