# Feature Specification: Home Page Infrastructure, Flow 2 (Consult) & Flow 9 (Taste Profile)

**Feature Branch**: `001-home-infra-flow2-flow9`  
**Created**: 2026-04-11  
**Status**: Draft  
**Source**: `docs/superpowers/specs/2026-04-10-home-subplans-1-2.md` — sub-plans 1 and 2 only  

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Consult Flow (Flow 2) end-to-end (Priority: P1)

A user types a natural-language query ("good ramen near Sukhumvit for a date") and submits it. The app immediately enters a six-step thinking animation, simultaneously fires the backend request, and reveals the primary recommendation card plus two alternatives once both the animation and the response have completed.

**Why this priority**: This is the core product value proposition — the decision engine delivering a confident recommendation. Everything else in the home page is secondary to this working correctly.

**Independent Test**: Can be fully tested by submitting any consult query with `NEXT_PUBLIC_CHAT_FIXTURES=true` and confirming the six-step animation runs, the skeleton card appears at step 3, the result card reveals after animation completes, and alternatives slide in 400 ms later.

**Acceptance Scenarios**:

1. **Given** a user is on the home page in any resting phase (`idle`, `cold-0`, `cold-1-4`, `taste-profile`), **When** the user types a consult query and submits, **Then** the phase transitions immediately to `thinking`, the six-step animation begins, and the fetch fires concurrently.

2. **Given** the thinking animation is running, **When** the fetch completes (either before or after animation), **Then** the result is held in a pending state until both the animation (4100 ms) and the fetch have finished — neither can reveal the result card independently.

3. **Given** both the animation and fetch are complete, **When** `tryReveal()` fires, **Then** the phase transitions to `result`, the primary card reveals with a scale animation (0.95 → 1.0, 300 ms), and the two alternative cards slide in 400 ms later.

4. **Given** the thinking animation is at step 3 (2200 ms elapsed), **When** step 3 completes, **Then** a skeleton card (110 px gray block + three shimmer bars) fades in over 200 ms.

5. **Given** the server returns `reasoning_steps`, **When** step N in the animation renders, **Then** the sub-label from `reasoning_steps[N].summary` fades in within 150 ms — either immediately if the response has already arrived, or as soon as the array populates if the step is already visible.

6. **Given** the fetch fails (network error, timeout, or server error), **When** the animation completes, **Then** the phase transitions to `error` and the error screen renders with a "Try again" button that pre-fills the last query.

---

### User Story 2 — Taste Profile Celebration (Flow 9) (Priority: P1)

A user with 5 or more saved places (and who hasn't confirmed their taste profile yet) arrives on the home page and sees a celebration screen showing three taste chips. They can confirm or dismiss each chip visually, then tap "Start exploring" to lock in the profile and reach the idle state. On next visit the celebration never reappears.

**Why this priority**: Flow 9 is the gateway from the onboarding ladder to the main experience. Without it, users with 5+ saves are stuck in a loop or see incorrect state.

**Independent Test**: Force `NEXT_PUBLIC_DEV_SAVED_COUNT=5` with `tasteProfileConfirmed=false` in localStorage. Verify the celebration screen renders, chips can be confirmed/dismissed, and "Start exploring" transitions to `idle` and persists `{ confirmed: true }` to localStorage. Reload and confirm `idle` renders directly.

**Acceptance Scenarios**:

1. **Given** a user has 5+ saved places and `tasteProfileConfirmed` is `false`, **When** the page loads and hydration completes, **Then** the phase is `taste-profile` and `TasteProfileCelebration` renders with three taste chips.

2. **Given** the taste profile celebration is showing, **When** the user taps a chip, **Then** the chip toggles between `pending`, `confirmed` (green treatment), and `dismissed` (25% opacity) states — visual only, not persisted.

3. **Given** the taste profile celebration is showing, **When** the user taps "Start exploring", **Then** `tasteProfileConfirmed: true` is written to localStorage, the phase transitions to `idle`, and `HomeIdle` renders.

4. **Given** a user has confirmed their taste profile (localStorage `tasteProfileConfirmed: true`), **When** the page reloads, **Then** the phase hydrates directly to `idle` — the Flow 9 celebration does not reappear.

5. **Given** the dev override `NEXT_PUBLIC_DEV_SAVED_COUNT=12` is set, **When** the page loads, **Then** the store uses the override value (not localStorage) and the phase resolves as `idle` (if `tasteProfileConfirmed: true`) or `taste-profile` (if unconfirmed).

---

### User Story 3 — Phase Hydration & Dev Override (Priority: P1)

On first mount, the home page correctly reads localStorage to determine which phase to render — cold-0, cold-1-4, taste-profile, or idle. The transition is seamless with no flash of wrong content. A dev override env var lets contributors force any phase without touching localStorage.

**Why this priority**: Hydration is the foundation of every phase. If it gets the wrong initial phase, all cold-start and taste-profile flows break. It must work before any other user story.

**Independent Test**: Set `NEXT_PUBLIC_DEV_SAVED_COUNT` to 0, 3, 5, and 12 in turn. Verify the store's phase value matches `cold-0`, `cold-1-4`, `taste-profile` (if unconfirmed), and `idle` respectively. Verify the `hydrating` phase renders nothing until `hydrated === true`.

**Acceptance Scenarios**:

1. **Given** no localStorage data and no dev override, **When** the page mounts and hydration runs, **Then** `savedPlaceCount = 0` and phase transitions to `cold-0`.

2. **Given** `localStorage.kebi-app.savedPlaces` contains 3 entries, **When** hydration runs, **Then** `savedPlaceCount = 3` and phase transitions to `cold-1-4`.

3. **Given** `localStorage.kebi-app.savedPlaces` contains 6 entries and `tasteProfileConfirmed = false`, **When** hydration runs, **Then** phase transitions to `taste-profile`.

4. **Given** `localStorage.kebi-app.savedPlaces` contains 6 entries and `tasteProfileConfirmed = true`, **When** hydration runs, **Then** phase transitions to `idle`.

5. **Given** `NEXT_PUBLIC_DEV_SAVED_COUNT=3` is set and localStorage has 10 saves, **When** hydration runs, **Then** the store uses the override value (3), not the localStorage value — dev override takes precedence.

6. **Given** the phase is `hydrating`, **When** the message area renders, **Then** nothing is shown until `hydrated === true` — prevents SSR hydration mismatch and flash of wrong content.

---

### User Story 4 — Infrastructure cleanup & Flow Registry scaffold (Priority: P2)

Old home-page components (`AgentResponseBubble.tsx`, `ChatMessage.tsx`, `home-empty-state.tsx`) are deleted. The Flow Registry pattern is scaffolded. The fetch layer with the fixtures swap flag is in place. Storage modules are created.

**Why this priority**: This is a prerequisite for all flows. However, it has no user-visible change — it delivers only developer-facing correctness. It ranks P2 because the user-visible flows (P1) depend on it, but the user doesn't directly interact with infrastructure.

**Independent Test**: Verify deleted components no longer exist in the repo. Verify `NEXT_PUBLIC_CHAT_FIXTURES=true` causes the chat client to return the consult fixture response instead of hitting the network. Verify `saved-places-storage.ts`, `taste-profile-storage.ts`, `location-storage.ts`, and `classify-intent.ts` exist and export the expected functions.

**Acceptance Scenarios**:

1. **Given** the cleanup is complete, **When** the developer searches the codebase for `AgentResponseBubble`, `ChatMessage`, or `home-empty-state`, **Then** none of these files exist.

2. **Given** `NEXT_PUBLIC_CHAT_FIXTURES=true`, **When** the chat client is called with any consult-classified message, **Then** the fixture response is returned immediately without a network call.

3. **Given** `NEXT_PUBLIC_CHAT_FIXTURES=false` or unset, **When** the chat client is called, **Then** the request goes to `POST /api/v1/chat` on the real backend.

4. **Given** the Flow Registry is scaffolded, **When** a developer adds a new flow, **Then** TypeScript produces a compile error if the `FlowId` union is extended without adding the corresponding entry to `FLOW_REGISTRY`.

5. **Given** the illustration files have been renamed per the cleanup pass, **When** the `Illustration` component is used with a renamed key, **Then** the correct SVG renders without error.

---

### Edge Cases

- What happens when the fetch completes in under 4100 ms? The result is held in `pendingResult` until the animation completes — the card never pops in early.
- What happens when the animation completes but the fetch is still in flight? The phase stays at `thinking` (blank after animation) until the fetch resolves — maximum wait is the fetch timeout (30 s).
- What happens when the server returns a response type other than `consult` (e.g., `recall`) after the client pre-routed to consult? The store honors the server type, dismisses the thinking phase, and routes to the correct flow.
- What happens when the user submits a new query while a consult is in flight? The in-flight abort controller fires, the pending state resets, and the new submission starts fresh.
- What happens when `NEXT_PUBLIC_DEV_SAVED_COUNT` is set in a production build? The override is ignored — dev overrides are blocked when `NODE_ENV === 'production'`.
- What happens when localStorage is unavailable (private browsing, storage blocked)? The storage modules catch the error and return safe defaults — `savedPlaceCount = 0`, `tasteProfileConfirmed = false`, `location = null`.

## Requirements *(mandatory)*

### Functional Requirements

**Sub-plan 1 — Infrastructure & Cleanup**

- **FR-001**: The system MUST delete `AgentResponseBubble.tsx`, `ChatMessage.tsx`, and `home-empty-state.tsx`, all imports that reference only these components, and any other unused components, functions, types, constants, or variables that are rendered dead by the cleanup (no live consumer after the deletion). This includes unused imports left behind in any file touched by the task.
- **FR-002**: The system MUST provide a `classifyIntent(message): 'consult' | 'recall' | 'save' | 'assistant'` pure function in `apps/web/src/lib/classify-intent.ts`.
- **FR-003**: The system MUST provide a `saved-places-storage.ts` module that reads and writes `localStorage.kebi-app.savedPlaces` and returns a count of saved places.
- **FR-004**: The system MUST provide a `taste-profile-storage.ts` module that reads and writes `localStorage.kebi-app.tasteProfile` including the `confirmed` boolean.
- **FR-005**: The system MUST provide a `location-storage.ts` module that reads and writes `localStorage.kebi-app.location` as `{ lat, lng } | null`.
- **FR-006**: The system MUST implement a `useHomeStore` Zustand store in `apps/web/src/store/home-store.ts` with the full 13-value `HomePhase` enum, hydration logic, and the `NEXT_PUBLIC_DEV_SAVED_COUNT` dev override.
- **FR-007**: The `useHomeStore` MUST expose a `hydrate()` action that reads from all three localStorage modules, seeds `savedPlaceCount`, `tasteProfileConfirmed`, and `location`, and sets the correct initial phase based on the four-way branch rule.
- **FR-008**: The `useHomeStore` MUST expose a `setLocation()` action that persists to `localStorage.kebi-app.location` and updates the store in one synchronous call.
- **FR-009**: The system MUST provide a `chat-client.ts` module that sends `POST /api/v1/chat` with `{ user_id, message, location }` and returns `ChatResponseDto`.
- **FR-010**: When `NEXT_PUBLIC_CHAT_FIXTURES=true`, the chat client MUST return the fixture for the classified intent without any network call.
- **FR-011**: The system MUST scaffold the Flow Registry with `FlowDefinition` interface, `FlowId` union, `FLOW_REGISTRY` object, `FLOW_BY_RESPONSE_TYPE` reverse lookup, and `FLOW_BY_CLIENT_INTENT` forward lookup — even if only the consult flow is registered in sub-plan 2.
- **FR-012**: The `FLOW_REGISTRY` object MUST use TypeScript's `satisfies` constraint so that any missing `FlowId` entry is a compile error.
- **FR-013**: The system MUST rename illustration SVGs and update the `Illustration` component to use the renamed keys per the cleanup pass spec.
- **FR-014**: The system MUST add i18n keys under `consult.*` and `tasteProfile.*` namespaces (and `home.idle.*`) in `en.json` and `he.json`. Flow numbers (`flow2`, `flow9`) are spec-tracking labels only and MUST NOT appear as code identifiers or i18n key prefixes.
- **FR-015**: The `NEXT_PUBLIC_DEV_SAVED_COUNT` override MUST be silently ignored when `NODE_ENV === 'production'`.
- **FR-015a**: The system MUST implement a `HomeIdle` component (replacing `home-empty-state.tsx`) that renders the `KebiIdleWelcoming` illustration, a "What are you in the mood for?" headline, and three suggestion chips that fill the input bar on tap.
- **FR-015b**: The system MUST implement a `HomeGreeting` component that renders on resting phases (`idle`, `cold-0`, `cold-1-4`) and is hidden during flow states, error, and `hydrating`.
- **FR-015c**: `ChatInput.tsx` MUST be simplified by removing its local message state and wiring its submit handler to call `store.submit()`. All existing markup and styling MUST remain unchanged.

**Sub-plan 2 — Flow 2 (Consult) + Flow 9 (Taste Profile)**

- **FR-016**: The system MUST implement a `ConsultThinking` component that renders six step rows from `FLOW_2_STEPS` constant with per-step `translateY` + opacity transitions, an active pulsing dot, and a completed checkmark dot.
- **FR-017**: `ConsultThinking` MUST fire six `setTimeout`s at offsets `[0, 700, 1500, 2300, 3000, 3700] ms` for step activation, with durations `[600, 700, 700, 600, 600, 400] ms`, and call `onAnimationComplete` at 4100 ms.
- **FR-018**: A skeleton card (110 px gray block + three shimmer bars) MUST appear at 2200 ms (after step 3 completes) and fade in over 200 ms.
- **FR-019**: The system MUST implement a `ConsultResult` component composed of `PrimaryResultCard`, `TasteMatchArc`, `CommunityProofLine`, `AlternativesDivider`, and `AlternativesGrid` with `AlternativeCard` items.
- **FR-020**: `PrimaryResultCard` MUST include a 16:9 hero photo (110 px tall), place name, context pills, a reasoning block with gold left border, source attribution, and an action row (Directions, Call, Share, Menu). Entry animation: scale 0.95 → 1.0, 300 ms.
- **FR-021**: `TasteMatchArc` MUST render a 44×44 px radial progress SVG with a placeholder value sourced from a `constants/placeholders.ts` file. Raw hex `TODO: tokenize` comment required for non-token colors.
- **FR-022**: `CommunityProofLine` MUST render a single italic muted line with a placeholder count from `constants/placeholders.ts`.
- **FR-023**: `AlternativeCard` items MUST slide in 400 ms after the primary card reveals (`translateY(12px → 0) + opacity 0 → 1, 400 ms`).
- **FR-024**: The `useHomeStore.submit()` action MUST implement the animation-fetch race: both `animationComplete` and `fetchComplete` flags must be true before `tryReveal()` transitions the phase to `result`.
- **FR-025**: Sub-labels in `ConsultThinking` MUST come from `reasoning_steps[i].summary` — empty string when not yet populated, never placeholder text.
- **FR-026**: The system MUST implement a `TasteProfileCelebration` component with three hardcoded taste chips, each with `pending | confirmed | dismissed` local state.
- **FR-027**: Confirmed chips MUST render with a forest green treatment (bg `#d8ecc8`, fg `#3a6018`, border `#b0d090`) with inline hex and `TODO: tokenize` comments. Dismissed chips MUST render at 25% opacity.
- **FR-028**: Tapping "Start exploring" MUST call `store.confirmTasteProfile()`, which writes `{ confirmed: true }` to localStorage and transitions phase to `idle`.
- **FR-029**: The `consultFlow` MUST be registered as the first entry in `FLOW_REGISTRY`, and `submit()` MUST use registry dispatch rather than a switch statement.
- **FR-030**: The `consult.fixtures.ts` MUST provide a fixture that returns a valid `ChatResponseDto` with `type: 'consult'` and realistic `reasoning_steps` and `primary` / `alternatives` data.

### Key Entities

- **HomePhase**: 13-value discriminated union driving what renders in the message area (`hydrating`, `cold-0`, `cold-1-4`, `taste-profile`, `idle`, `thinking`, `result`, `recall`, `save-sheet`, `save-snackbar`, `save-duplicate`, `assistant-reply`, `starter-pack`, `error`).
- **HomeState**: Zustand store slice — `phase`, `query`, `result`, `reasoningSteps`, `error`, `hydrated`, `tasteProfileConfirmed`, `savedPlaceCount`, `location`, `animationComplete`, `fetchComplete`, `pendingResult`, `pendingError`, `abortController`, flow-specific slots.
- **FlowDefinition**: Interface contract for a single flow — `id`, `matches` (clientIntent + responseType), `phase`, `inputPlaceholderKey`, `schema`, `fixture`, `onResponse`, `Component`.
- **ChatResponseDto**: Shared TS type in `libs/shared` — discriminated union on `type: 'consult' | 'recall' | 'extract-place' | 'assistant' | 'clarification' | 'error'`.
- **ConsultResponseData**: The `data` field of a `consult` response — `primary`, `alternatives`, `reasoning_steps`, optional `context_chips`.
- **SavedPlaceStub**: Minimal place record written to localStorage by Flow 4 (sub-plan 6), read by `saved-places-storage.ts`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user submitting a consult query sees the first thinking step appear within 100 ms of hitting send — no perceptible delay before the animation starts.
- **SC-002**: The consult result card is never revealed before the six-step animation reaches 4100 ms, regardless of how fast the backend responds.
- **SC-003**: The skeleton card appears within 100 ms of the 2200 ms animation checkpoint — visible during the second half of the thinking animation.
- **SC-004**: Tapping "Start exploring" on the taste profile screen transitions to the idle state in under 200 ms and survives a page reload (the celebration never reappears).
- **SC-005**: Setting `NEXT_PUBLIC_DEV_SAVED_COUNT` to 0, 3, 5, or 12 and reloading the page places the store in `cold-0`, `cold-1-4`, `taste-profile` (if unconfirmed), or `idle` 100% of the time — no flicker to a different phase.
- **SC-006**: With `NEXT_PUBLIC_CHAT_FIXTURES=true`, submitting a consult query returns a fixture response without any outbound network request.
- **SC-007**: Deleting the three legacy components (`AgentResponseBubble`, `ChatMessage`, `home-empty-state`) and all dead code produces zero TypeScript or lint errors — no orphaned imports, unused variables, or unreachable exports remain in any file touched by the task.
- **SC-008**: Adding a new `FlowId` to the `FlowId` union without updating `FLOW_REGISTRY` produces a TypeScript compile error, not a runtime error.

## Clarifications

### Session 2026-04-11

- Q: Should Flow 2 / Flow 9 components follow the project's always-on logical property standard, or is using physical properties temporarily acceptable? → A: Always use logical properties — project standard applies, no special exemption for these components.
- Q: Are `HomeIdle` and `HomeGreeting` in scope for this task? → A: Both in scope — build them as part of sub-plan 1 (infrastructure).
- Q: What is the extent of the `ChatInput.tsx` simplification? → A: Wire to `store.submit()` only — remove local message state, keep all markup and styling unchanged.

## Assumptions

- **A-001**: `libs/shared/src/lib/types.ts` already contains `ChatRequestDto`, `ChatResponseDto`, and `ChatResponseType` as the unified type from the gateway refactor (commit `31e963c`). Sub-plans 1 & 2 do not modify this file.
- **A-002**: `POST /api/v1/chat` is callable and returns a `ChatResponseDto`. Sub-plans 1 & 2 only exercise this via fixtures; live endpoint verification is deferred to sub-plan 6.
- **A-003**: The three hardcoded taste chips are `"Ramen lover"`, `"Budget-friendly"`, `"Night owl"` — matching `v10.html` lines 341–343.
- **A-004**: The animation timing constants (`[0, 700, 1500, 2300, 3000, 3700] ms` offsets, `[600, 700, 700, 600, 600, 400] ms` durations) are locked per Decision 3 and are not tunable via config in this sub-plan.
- **A-005**: The Zustand store is a new dependency — `zustand` is added to `apps/web` as part of sub-plan 1.
- **A-006**: Placeholder values for `TasteMatchArc` and `CommunityProofLine` are centralized in `apps/web/src/constants/placeholders.ts`. Real values from the backend are deferred.
- **A-007**: Dark mode and color tokenization for Flow 2 / Flow 9 components are explicitly out of scope. Inline hex colors with `TODO: tokenize` comments are accepted for colors outside the existing token set. RTL is **not** out of scope — all components MUST use logical CSS properties (`ms`/`me`/`ps`/`pe`, `text-start`/`text-end`, `border-s`/`border-e`, etc.) per the project standard. No physical directional properties (`pl`, `mr`, `text-left`, etc.) are permitted.
- **A-008**: The `clarificationMessage` store slot exists after sub-plan 1 but the `ClarificationHint` component is only wired in sub-plan 5. In sub-plan 2, the slot is present in the store but has no visual representation yet.
