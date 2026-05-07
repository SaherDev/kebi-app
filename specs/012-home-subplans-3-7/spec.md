# Feature Specification: Home Page Sub-plans 3–7

**Feature Branch**: `012-home-subplans-3-7`  
**Created**: 2026-04-11  
**Status**: Draft  
**Input**: Implement sub-plans 3–7 from `docs/superpowers/specs/2026-04-10-home-subplans-3-7.md`. Sub-plans 1–2 have already landed on `001-home-infra-flow2-flow9`. Code is source of truth for any decisions made during that landing.

---

## Context

This feature delivers the remaining home-page experience pillars that depend on the store skeleton, Flow Registry, fetch layer, and consult/taste fixtures from sub-plans 1–2.

| # | Sub-plan | Core deliverable |
|---|----------|-----------------|
| 3 | Flow 7 — Cold 0 | First-time user onboarding screen |
| 4 | Flow 8 — Cold 1–4 + City Starter Pack | Early-user encouragement screen with popular picks |
| 5 | Flow 11 + Clarification hint | Assistant reply rendered as thread bubble |
| 6 | Flow 4 — Save | Half-sheet place-save flow + success snackbar |
| 7 | Flow 3 — Recall | Recall results list with cascade animation + mode-override pill |

Additionally: the illustration system is refactored from scattered named exports to a typed registry + single generic component, and the fetch layer is extended with a typed `ChatResponseDto` discriminated union, Zod boundary validation, and per-intent fixture files.

---

## Clarifications

### Session 2026-04-11

- Q: After the `SavedSnackbar` auto-dismisses (or the user taps outside it), what phase does the home page return to? → A: Return to whatever phase was active before the save sheet opened.
- Q: When the user taps an assistant/clarification bubble to dismiss it, does that remove it from the thread array or mark it hidden? → A: Keep the entry but mark it `dismissed: true` so it renders nothing (append-only thread preserved).
- Q: When should `kebi-app.savedPlaces` localStorage array be written — optimistically on sheet open or only on server `status: 'resolved'`? → A: Write only when server returns `status: 'resolved'`.
- Q: Should `<Illustration />` auto-detect `prefers-reduced-motion` internally or rely on consumers passing `animate={false}`? → A: Auto-detect inside the component — no consumer action needed.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — New user sees a welcoming cold-start screen (Priority: P1)

A brand-new user opens the home page for the first time with zero saved places. Instead of a blank, purposeless screen they see a friendly Kebi illustration, a clear headline, a three-step guide to saving from TikTok or Instagram, a muted paste hint, and two example consult prompts. They understand immediately what to do next.

**Why this priority**: Cold-start zero is the first impression for every new user. Without it the home page is blank and the product's value is invisible.

**Independent Test**: Set `localStorage.kebi-app.savedCount` to `0` (or clear it), load the home page in the idle phase, and verify the cold-start zero layout renders with the correct illustration, headline, three steps, hint, and two suggestion pills.

**Acceptance Scenarios**:

1. **Given** a user with zero saved places and no confirmed taste profile, **When** the home page loads in the idle phase, **Then** the cold-start zero screen is shown with a Kebi illustration, the headline "Save places you love. I'll figure out the rest.", three numbered share-extension steps, a paste hint, and two static suggestion pills.
2. **Given** the cold-start zero screen is visible, **When** the user taps one of the suggestion pills, **Then** the text is filled into the input bar but nothing is submitted.
3. **Given** the cold-start zero screen is visible, **When** the input bar is focused, **Then** the placeholder reads "Paste a link or type a name…".

---

### User Story 2 — Early user sees progress and a popular nearby pick (Priority: P1)

A user with 1–4 saved places sees a compact encouragement screen: their saves listed, a "What's good nearby" section with a placeholder popular card (from consult fixtures), and a "City starter pack" link. The popular card has a dashed gold border and a footnote explaining that taste improves with more saves. When they save a new place from this state, the success snackbar includes a "Taste signals updating." gold italic line.

**Why this priority**: Retention depends on users feeling progress during the early phase. Without visible feedback, users with only 1–2 saves may not return.

**Independent Test**: Set `localStorage.kebi-app.savedCount` to `2`, reload, and verify the cold-1-4 layout appears with the save list, popular card with dashed gold border, and starter-pack link. Then trigger a save and verify the snackbar shows the "Taste signals updating." addendum.

**Acceptance Scenarios**:

1. **Given** a user with `savedPlaceCount` of 2, **When** the home page loads, **Then** the cold-1-4 screen appears with the Kebi encouraging illustration, the headline, the two saved place rows, the popular nearby card with dashed gold border and footnote, and the starter-pack link.
2. **Given** the cold-1-4 screen is showing, **When** the user successfully saves a new place, **Then** the success snackbar shows the gold italic "Taste signals updating." line above the normal "Saved!" body.
3. **Given** a user with `savedPlaceCount ≥ 5`, **When** a save succeeds, **Then** the "Taste signals updating." line is absent from the snackbar.

---

### User Story 3 — User saves a place via the half-sheet (Priority: P1)

A user types a TikTok URL or place name. The input is client-classified as a save intent and a half-sheet slides up from the bottom showing the place details, thumbnail, and a "Save to Kebi" button. The user taps the button, sees "Saving…" with a spinner, then the sheet closes and a success snackbar slides in. If the place is already saved, the sheet shows a duplicate state with a "View saved place" option. If the save fails, an error message and "Try again" button appear.

**Why this priority**: Saving is the primary data-ingestion action. It gates everything else (recall, consult accuracy).

**Independent Test**: Type `tiktok.com/@foodie/ramen123` in the input bar (fixture). Verify the save sheet opens with pending state; tap "Save to Kebi"; see the saving spinner; then see the snackbar. Then type `Fuji Ramen Bangkok` (duplicate fixture) and verify the duplicate state renders.

**Acceptance Scenarios**:

1. **Given** the user submits a URL or short place name, **When** the client classifier identifies it as a save, **Then** the save half-sheet opens immediately with the place thumbnail, name, source badge, location, and a "Save to Kebi" button.
2. **Given** the save sheet is open with `pending` status, **When** the user taps "Save to Kebi", **Then** the button changes to "Saving…" with a spinner and is disabled.
3. **Given** the save completes successfully, **When** the server returns `status: 'resolved'`, **Then** the sheet closes and the success snackbar slides in showing the place name and source.
4. **Given** the server returns `status: 'duplicate'`, **When** the response lands, **Then** the sheet body switches to the duplicate state showing the knowing illustration, "Already in your places" headline, original save date, and "View saved place" button.
5. **Given** the save fails, **When** the server returns an error, **Then** the sheet shows the error message and a "Try again" button.
6. **Given** the success snackbar is visible, **When** 2800 ms elapses, **Then** the snackbar auto-dismisses.
7. **Given** the user taps the dark overlay behind the save sheet, **When** the tap registers, **Then** the sheet dismisses.

---

### User Story 4 — User retrieves saved places via recall (Priority: P2)

A user types a memory fragment like "that ramen place from TikTok". The client classifier routes to recall; results appear as a staggered cascade list with thumbnails, place names, and provenance lines. A "Want a recommendation instead?" gold pill is shown. If fewer than 3 results are found and there are no more, a dashed-border footer card appears offering to search more broadly via consult.

**Why this priority**: Recall is the second core engagement loop. Users who cannot find saved places churn.

**Independent Test**: Type "that ramen place from TikTok" (2-result recall fixture). Verify the results list renders with staggered animation, provenance lines, and the mode-override pill. Then type a query with no matching fixture and verify the empty-state footer renders.

**Acceptance Scenarios**:

1. **Given** the user types a memory-language query, **When** the server returns a recall response, **Then** the results list renders with the "Found in your saves" header, mode-override pill, and each result row showing thumbnail, place name, and provenance.
2. **Given** results are rendering, **When** each row appears, **Then** it enters with an 80 ms staggered opacity and translateY animation.
3. **Given** the recall fetch has not resolved after 600 ms, **When** still awaiting results, **Then** a "searching your saves…" muted line replaces the results header.
4. **Given** the results list has ≤ 2 items and `hasMore === false`, **When** rendered, **Then** a dashed-border footer card appears with "Nothing else matches. Want me to find more like this?".
5. **Given** the user taps the mode-override pill, **When** tapped, **Then** the same query is resubmitted as a consult without requiring a new input.

---

### User Story 5 — User receives an assistant reply or clarification (Priority: P2)

When the user asks something outside consult/recall/save, the server returns a `type: 'assistant'` or `type: 'clarification'` response. The message appears as a bubble in the chat thread. The user can dismiss it by tapping the card or by typing a new query.

**Why this priority**: Graceful handling of off-intent queries prevents dead ends. Without this, the UI is stranded when the server returns an unexpected response type.

**Independent Test**: Type the literal string "clarify me" (clarification fixture) and verify a bubble appears in the thread. Then type any unrecognised message (assistant fixture) and verify the assistant reply bubble appears.

**Acceptance Scenarios**:

1. **Given** the server returns `type: 'assistant'`, **When** the response lands, **Then** a muted rounded card with the message text is appended to the chat thread with a 200 ms fade-in.
2. **Given** the assistant reply card is visible, **When** the user taps it, **Then** it dismisses.
3. **Given** the assistant reply card is visible, **When** the user submits a new query, **Then** the card is cleared before the new submission dispatches.
4. **Given** the server returns `type: 'clarification'`, **When** the response lands, **Then** the clarification message is appended to the chat thread as a bubble with the same treatment as an assistant reply.

---

### User Story 6 — Illustration system uses a typed registry (Priority: P2)

All home-page illustrations are accessed via a single `<Illustration id="…" />` component backed by a typed registry. Orphaned named exports from the previous illustration file are removed. Existing SVGs are renamed to semantic names matching the registry. Adding a new illustration requires only: dropping an SVG in `/public/illustrations/`, adding one registry entry, and using `<Illustration id="new-id" />`.

**Why this priority**: The old system has many orphaned exports and no single source of truth for "which flow uses which illustration". This blocks safe maintenance.

**Independent Test**: Run TypeScript compilation — zero errors. Grep for old named exports (`KebiHomeInput`, `KebiSplash`, `KebiSuccess`, etc.) — zero results outside deleted/replaced files. Verify each illustration referenced in the per-flow mapping table renders in its flow.

**Acceptance Scenarios**:

1. **Given** the illustration registry is in place, **When** a consumer uses the `<Illustration />` component, **Then** the `id` prop is strictly typed to the `IllustrationId` union.
2. **Given** the six SVG renames are done, **When** each renamed file is loaded in the browser, **Then** the visual appearance is unchanged.
3. **Given** any orphaned named export is searched in the codebase, **When** grepped, **Then** zero results are found outside the deleted file.

---

### Edge Cases

- User clears `localStorage.kebi-app.savedPlaces` manually but `kebi-app.savedCount` is still non-zero — `ColdStartOneToFour` shows a placeholder row rather than crashing.
- Recall fetch returns 0 results — the empty-state footer card renders.
- Save sheet is open when the user navigates to a different page — the sheet is mounted at the `<HomePage>` root and dismisses when the phase transitions.
- `SavedSnackbar` auto-dismiss timer fires while the user is mid-input — the timer still runs, phase restores to `preSavePhase`; this is acceptable behaviour.
- If `preSavePhase` is not recorded (e.g. cold restart mid-flow), the fallback restore phase is `idle`.
- Illustration SVG file is missing from `/public/illustrations/` despite a valid registry `id` — the `<img>` renders broken; caught during implementation verification, not guarded at runtime.
- `NEXT_PUBLIC_CHAT_FIXTURES` set to `true` in production — real API calls are bypassed silently. Must be documented in environment setup.
- Client classifier routes to `save` and opens the sheet, but the server returns `type: 'consult'` — the store dismisses the sheet and transitions to `thinking`.

---

## Requirements *(mandatory)*

### Functional Requirements

**Flow 7 — Cold Start Zero**

- **FR-001**: When `savedPlaceCount === 0` and the home page is in the idle phase, the system MUST display the cold-start zero screen instead of the default idle view.
- **FR-002**: The cold-start zero screen MUST show: a Kebi illustration, the headline "Save places you love. I'll figure out the rest.", the subline "The easiest way to save is from TikTok or Instagram", three numbered share-extension steps, a muted paste hint, and two static suggestion pills.
- **FR-003**: Tapping a suggestion pill MUST fill the input bar with the pill's text without submitting.
- **FR-004**: The input bar placeholder MUST read "Paste a link or type a name…" when the phase is `cold-0`.
- **FR-005**: The cold-start zero component MUST be stateless and receive all interaction via props.

**Flow 8 — Cold Start 1–4 + Popular Nearby**

- **FR-006**: When `1 ≤ savedPlaceCount ≤ 4` and the home is in the idle phase, the system MUST display the cold-start 1–4 screen.
- **FR-007**: The cold-start 1–4 screen MUST show: the Kebi encouraging illustration, the headline "The more you save, the better I get.", the subline "Recall works now. Consult shows what's good nearby.", a compact list of saved place stubs, a "What's good nearby" label, a `PopularNearbyCard`, and a "City starter pack" link.
- **FR-008**: `PopularNearbyCard` MUST wrap a `PrimaryResultCard` with a dashed gold border, a "Popular right now" small-caps label above, and a muted italic footnote below.
- **FR-009**: When `savedPlaceCount < 5` and the phase is `result`, the primary result MUST be wrapped in a `PopularNearbyCard`.
- **FR-010**: When a save succeeds and `1 ≤ savedPlaceCount ≤ 4` at the moment of display, the `SavedSnackbar` MUST include a gold italic "Taste signals updating." line above the normal body.
- **FR-010a**: `kebi-app.savedPlaces` and `kebi-app.savedCount` MUST be written to localStorage only after the server returns `status: 'resolved'`. Duplicate and error responses MUST NOT increment the count or append to the array.

**Flow 4 — Save**

- **FR-011**: When the client classifier identifies a save intent, the system MUST immediately open the `SaveSheet` without waiting for the server response.
- **FR-012**: The save sheet MUST display: a handle bar, 52 × 52 px thumbnail, place name in serif font, gold source badge, location text, and a status-driven body.
- **FR-013**: The save sheet MUST support four status states: `pending`, `saving`, `duplicate`, and `error`.
- **FR-014**: Tapping outside the save sheet (on the dark overlay) MUST dismiss the sheet.
- **FR-015**: The save sheet MUST be mounted at the `<HomePage>` root level, overlaying all phases.
- **FR-016**: The `SavedSnackbar` MUST auto-dismiss after 2800 ms. On dismissal, the store MUST restore the phase that was active immediately before the save sheet opened (stored as `preSavePhase` in the store).
- **FR-017**: The `SavedSnackbar` MUST render an "Undo" gold text link (no-op in this scope, with a logged TODO).

**Flow 3 — Recall**

- **FR-018**: When the server returns `type: 'recall'`, the system MUST render `RecallResults` with a "Found in your saves" header, `ModeOverridePill`, and a staggered results list.
- **FR-019**: Each recall result row MUST show: a 38 × 38 px thumbnail (muted square fallback if absent), bold place name, and a provenance line.
- **FR-020**: Each result row MUST animate in with an 80 ms staggered delay, 200 ms opacity + translateY transition.
- **FR-021**: When `hasMore === false` and `results.length ≤ 2`, the system MUST render a dashed-border footer card with "Nothing else matches. Want me to find more like this?".
- **FR-022**: Tapping the footer card MUST re-submit the same query as a consult.
- **FR-023**: Tapping the `ModeOverridePill` MUST re-submit the current query as a consult.
- **FR-024**: When the recall fetch exceeds 600 ms, the system MUST show a "searching your saves…" breadcrumb in place of the results header.

**Flow 11 — Assistant Reply**

- **FR-025**: When the server returns `type: 'assistant'` or `type: 'clarification'`, the system MUST append the message as a bubble to the chat thread.
- **FR-026**: Tapping an assistant reply bubble MUST mark it `dismissed: true` in the thread entry; the bubble renders nothing when dismissed. The thread array is never spliced.
- **FR-027**: Submitting a new query MUST set `dismissed: true` on any visible assistant/clarification bubble in the thread before dispatching.

**Illustration System**

- **FR-028**: The illustration layer MUST be replaced with a typed `IllustrationId` union, an `ILLUSTRATION_REGISTRY` map, and a single `<Illustration id="…" />` component.
- **FR-029**: All six SVG files MUST be renamed to their semantic registry names via `git mv`.
- **FR-030**: All orphaned named exports MUST be removed from the codebase.
- **FR-031**: The `<Illustration />` component MUST auto-detect the OS `prefers-reduced-motion` media query internally and suppress all animation when it is set. The `animate` prop (default `true`) remains available to force-suppress animation regardless of OS setting (e.g. for screenshots).

**Fetch Layer & i18n**

- **FR-032**: `libs/shared/src/lib/types.ts` MUST export a `ChatResponseDto` discriminated union covering `consult`, `extract-place`, `recall`, `assistant`, `clarification`, and `error` branches.
- **FR-033**: The chat client MUST validate every response branch against its Zod schema at the API boundary.
- **FR-034**: `NEXT_PUBLIC_CHAT_FIXTURES=true` MUST route all chat calls to fixture files with per-intent delays (consult 2500 ms, recall 400 ms, save 800 ms, assistant 300 ms).
- **FR-035**: The client-side intent classifier MUST be a pure function with no external dependencies.
- **FR-036**: All user-facing strings introduced by this feature MUST be added to both `en.json` and `he.json` locale files.
- **FR-037**: All illustration alt-text keys MUST be added under a top-level `illustrations` section in both locale files.

### Key Entities

- **SavedPlaceStub**: A lightweight client-side representation of a saved place (name, source, thumbnail, location) persisted in `localStorage`. Written by Flow 4 and consumed by Flow 8's compact save list.
- **SaveSheetPlace**: The place metadata shown inside the save sheet — name, source, location, optional thumbnail.
- **RecallItem**: One result row from a recall response — place ID, name, address, optional cuisine/price, optional source URL, save timestamp, match reason, optional thumbnail.
- **ChatResponseDto**: Discriminated union type in `libs/shared` covering all server response shapes the chat client can receive.
- **IllustrationId**: String literal union identifying every illustration in the registry. Strictly typed — invalid IDs are caught at compile time.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every home-page phase (`cold-0`, `cold-1-4`, `thinking`, `result`, `recall`, `save-sheet`, `save-duplicate`, `save-snackbar`, `error`, `idle`, `taste-profile`, `assistant-reply`) renders the correct UI without runtime errors.
- **SC-002**: A new user (zero saves) lands on a screen that communicates the product's value and first action within 1 second of page load.
- **SC-003**: Save flow completes (sheet opens → saving state → snackbar visible) within 3 seconds of the user tapping "Save to Kebi" in fixture mode.
- **SC-004**: Recall results begin appearing within 600 ms of the server response; if the response is delayed beyond 600 ms, the breadcrumb appears within 50 ms of crossing that threshold.
- **SC-005**: TypeScript compilation produces zero errors after all orphaned illustration exports are removed.
- **SC-006**: Grepping the codebase for any of the deleted named illustration exports returns zero results outside the deleted/replaced files.
- **SC-007**: All user-facing strings render in both English (`/en/`) and Hebrew (`/he/`) without missing-key placeholders.
- **SC-008**: The save sheet's duplicate state renders with the original save date when the duplicate fixture is triggered.
- **SC-009**: The mode-override pill re-routes a recall query to consult in a single tap without requiring a new query input.
- **SC-010**: The `PopularNearbyCard` dashed gold border and footnote are visible whenever `savedPlaceCount < 5` and a consult result is showing.

---

## Assumptions

1. Sub-plans 1–2 have landed and the store skeleton, Flow Registry, `HomePhase` enum, `ConsultThinking`, `PrimaryResultCard`, `ConsultError`, `TasteProfileCelebration`, `HomeIdle`, and `HomeGreeting` components are already in place.
2. The `chatClient` architecture (interface + HTTP transport + fixture toggle) was established in sub-plans 1–2 — this task extends the fixture files and typed response shapes, not the architecture itself.
3. `localStorage.kebi-app.savedCount` (integer) is the primary saved-count signal. The `kebi-app.savedPlaces` array is written by Flow 4 in this task and consumed by `ColdStartOneToFour`.
4. The six SVG files targeted for renaming have been visually confirmed to match their semantic labels during the spec's design phase. If any rename looks wrong during implementation, the escape hatch is extracting the authoritative pose from `v10.html`.
5. The "Undo" save action is out of scope — only the UI affordance (gold text link) is delivered; the action is a no-op with a logged TODO.
6. The `CityStarterPack` full browsing screen is out of scope — only the link affordance is delivered.
7. Flow 10 (return-user banner) and Flow 5 (voice input) are out of scope; their illustration assets are kept in the registry but the components are deferred.
8. If `framer-motion` is not yet approved, CSS-only transitions replace it for save sheet and snackbar animations.
