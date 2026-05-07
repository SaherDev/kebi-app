# Implementation Plan: Home Page Infrastructure, Flow 2 & Flow 9

**Branch**: `001-home-infra-flow2-flow9` | **Date**: 2026-04-11 | **Spec**: [spec.md](./spec.md)

## Summary

Replace the echo-only home page with the full phase-driven architecture. Sub-plan 1 installs the Zustand store, Flow Registry scaffold, localStorage storage modules, client-side intent classifier, fixtures-backed chat client, and a cleanup pass (delete dead components, restructure i18n). Sub-plan 2 builds Flow 2 (six-step consult thinking + result card) and Flow 9 (taste profile celebration), both wired to the registry.

## Technical Context

**Language/Version**: TypeScript 5.x / Node 20 LTS  
**Primary Dependencies**: Next.js 16, React 19, Zustand (new), Zod (new), framer-motion v11 (existing), Tailwind v3, shadcn/ui, Clerk, next-intl  
**Storage**: localStorage only (no new DB/API writes)  
**Testing**: Jest + React Testing Library (`pnpm nx test web`)  
**Target Platform**: Browser (Next.js App Router, client components)  
**Project Type**: Frontend feature — `apps/web` only  
**Performance Goals**: First thinking step visible <100 ms after submit; result card never reveals before 4100 ms animation completes  
**Constraints**: No new NestJS routes; no new FastAPI routes; fixtures-first (live endpoint deferred to sub-plan 6); logical CSS properties only (no physical directions)  
**Scale/Scope**: Single page (`/home`), 13 `HomePhase` values, 5 flows in registry (only consult registered in this task)

## Constitution Check

*GATE: Must pass before implementation.*

| Rule | Status | Notes |
|------|--------|-------|
| Two-repo boundary (§I) | ✅ Pass | `apps/web` only. No NestJS or FastAPI changes. |
| Nx module boundaries (§II) | ✅ Pass | `apps/web` imports `libs/shared` and `libs/ui`. No cross-boundary imports. |
| ADR-007: Tailwind v3 + shadcn/ui | ✅ Pass | Existing setup, no changes. |
| ADR-003: No `.env` files | ✅ Pass | `NEXT_PUBLIC_CHAT_FIXTURES` / `NEXT_PUBLIC_DEV_SAVED_COUNT` are public env vars, safe. |
| ADR-004: Clerk auth | ✅ Pass | `userId` sourced from `useAuth()`, injected into store. |
| §VII Frontend Standards (RTL, i18n, semantic tokens) | ✅ Pass | All components use logical properties; all strings go through `useTranslations()`; semantic tokens only (inline hex marked `TODO: tokenize`). |
| §VIII Code Standards | ✅ Pass | `kebab-case` files, `PascalCase` components, shared types in `libs/shared`. |
| §X Required Skills | ✅ Pass | `nextjs16-skills`, `vercel-react-best-practices`, `web-design-guidelines`, `vercel-composition-patterns` must be invoked before implementation. |

No violations. No Complexity Tracking required.

## Project Structure

### Documentation (this feature)

```text
specs/001-home-infra-flow2-flow9/
├── plan.md              ← this file
├── research.md          ← phase 0 output
├── data-model.md        ← phase 1 output
├── contracts/           ← phase 1 output
└── tasks.md             ← /speckit.tasks output (not yet)
```

### Source Code

```text
apps/web/src/
  flows/
    flow-definition.ts          ← FlowDefinition interface, FlowId union
    registry.ts                 ← FLOW_REGISTRY, FLOW_BY_RESPONSE_TYPE, FLOW_BY_CLIENT_INTENT
    consult/
      index.ts                  ← exports consultFlow: FlowDefinition
      ConsultThinking.tsx
      ConsultResult.tsx
      PrimaryResultCard.tsx
      AlternativeCard.tsx
      TasteMatchArc.tsx
      CommunityProofLine.tsx
      consult.schema.ts
      consult.fixtures.ts
      consult.constants.ts      ← FLOW_2_STEPS, timing arrays
  store/
    home-store.ts               ← useHomeStore (Zustand)
  lib/
    classify-intent.ts          ← classifyIntent() pure function
    chat-client.ts              ← chatClient + chatClientFixtures
  storage/
    saved-places-storage.ts
    taste-profile-storage.ts
    location-storage.ts
  constants/
    placeholders.ts             ← TASTE_MATCH_ARC_PLACEHOLDER, COMMUNITY_PROOF_COUNT
    home-suggestions.ts         ← CONSULT_SUGGESTIONS, TASTE_CHIP_BANK
  components/
    home/
      HomeIdle.tsx
      HomeGreeting.tsx
      TasteProfileCelebration.tsx
      ConsultError.tsx
    layout/
      ClarificationHint.tsx     ← scaffold only (wired in sub-plan 5)
  app/[locale]/(main)/home/
    page.tsx                    ← full rewrite

  [DELETE — dead after rewrite]
  components/AgentResponseBubble.tsx
  components/AgentStep.tsx
  components/ChatMessage.tsx
  components/home-empty-state.tsx
  components/EmptyState.tsx
  components/LoadingState.tsx
  components/ReasoningBlock.tsx
  components/PlaceCard.tsx      ← only consumer was AgentResponseBubble

libs/shared/src/lib/
  types.ts                      ← add ConsultResponseData, ReasoningStep, RecallItem, typed subtypes
```

**Structure Decision**: Flow components live in `flows/<flow-name>/` (self-contained modules). Resting-state and layout components live in `components/home/` and `components/layout/`. Store in `store/`. Storage utils in `storage/`. This matches the master spec's Flow Registry folder structure exactly.

---

## Phase 0: Research

### R-001 — Zustand store patterns with Clerk userId

**Decision**: Store holds `userId: string | null`. `HomePage` calls `store.setUserId(userId)` in a `useEffect` seeded from `useAuth().userId`. This mirrors how `useApiClient()` already handles the Clerk token — dependency injected from the component layer, not imported directly into the store.

**Rationale**: Simple, readable, and consistent with the existing `useApiClient` hook pattern. The `userId` is stable per Clerk session, so stale-state risk is negligible in practice.

**Alternatives considered**: (a) pass `userId` as param to every `submit()` call — verbose; (b) store a `getAuth` getter closure — adds indirection without real benefit for a stable value.

### R-002 — Zustand and Zod package versions

**Decision**: Install `zustand@^5` (latest stable) and `zod@^3` in `apps/web`.

**Rationale**: Zustand 5 is the current major, has full React 19 support. Zod 3 is the ecosystem standard for runtime schema validation; the spec uses it for `FlowDefinition.schema`.

**Alternatives considered**: Jotai — rejected (not in ADR, user chose Zustand per Decision 8 in master spec). Valibot — rejected (smaller ecosystem, no existing project precedent).

### R-003 — Illustration rename mapping

**Decision**: No SVG files are renamed or deleted. Instead, `kebi-app-illustrations.tsx` gains new named exports that alias existing SVGs to the spec's canonical names:

| New export name | Maps to existing SVG | Used by |
|---|---|---|
| `KebiIdleWelcoming` | `kebi-app-home-input.svg` | `HomeIdle`, `ConsultError` |
| `KebiExcited` | `kebi-app-success.svg` | `TasteProfileCelebration` |

Old exports (`KebiHomeInput`, etc.) are removed if their only consumer is a component being deleted. Shared exports (`KebiAuth`, `KebiEmpty`) are untouched.

**Rationale**: The spec says "illustrations rename" — renaming the SVG files themselves would break `/places` page which imports `KebiEmpty` directly. Renaming only the TS exports is safe and achieves the spec goal (canonical names in code) without touching static assets.

### R-004 — i18n key restructure scope

**Decision**: Add new `flow2.*` and `flow9.*` top-level namespaces to `en.json` and `he.json`. Retain existing `home.*` keys that are still used by `HomeEmptyState`-equivalent components (now `HomeIdle` and `HomeGreeting`). Remove keys only consumed by deleted components.

**Keys to add (en.json)**:
```json
{
  "consult": {
    "header": { "thinkingAbout": "thinking about" },
    "steps": {
      "understanding": "Understanding what you're looking for",
      "savedPlaces": "Checking your saved places",
      "discovering": "Discovering nearby options",
      "openNow": "Filtering for open now",
      "comparing": "Comparing your best matches",
      "found": "Found your match"
    },
    "result": {
      "header": "kebi-app recommends",
      "divider": "or, depending on your mood…",
      "source": { "saved": "From your saves", "discovered": "New discovery" },
      "actions": { "directions": "Directions", "call": "Call", "share": "Share", "menu": "Menu" }
    },
    "error": {
      "offline": { "headline": "You're offline", "body": "Check your connection and try again." },
      "timeout": { "headline": "That took too long", "body": "The service is slow right now. Try again in a moment." },
      "server": { "headline": "Something went wrong", "body": "We hit a snag. Try again." },
      "generic": { "headline": "Couldn't get a result", "body": "Try rephrasing your query." },
      "retry": "Try again"
    },
    "placeholder": "What are you in the mood for?",
    "skeleton": { "searching": "searching…" }
  },
  "tasteProfile": {
    "headline": "Your taste profile is ready.",
    "subline": "Is this you? Confirm or correct.",
    "cta": "Start exploring"
  },
  "home": {
    "idle": {
      "headline": "What are you in the mood for?",
      "suggestions": {
        "0": "Cheap dinner nearby",
        "1": "Ramen for a date night",
        "2": "Coffee spot to work from"
      }
    }
  }
}
```

**Keys to remove**: Any `home.*` key consumed exclusively by `home-empty-state.tsx` (which is deleted). Keys shared with `HomeIdle` (`home.suggestions.*`) are retained and restructured.

**Note**: i18n namespaces use semantic names (`consult`, `tasteProfile`, `home`) — never flow numbers. Flow numbers (Flow 2, Flow 9) are spec-tracking labels only, not code identifiers.

### R-005 — ChatInput prop rename

**Decision**: Rename `onSend` prop to `onSubmit` in `ChatInput.tsx`. Update the only remaining caller (`home/page.tsx`, which is being fully rewritten) to use `onSubmit`. No other file uses `ChatInput` directly.

**Rationale**: The master spec's `page.tsx` code snippet uses `onSubmit={store.submit}`. FR-015c says keep markup/styling unchanged — prop rename is not a markup change.

### R-006 — Dead component audit

Components to delete (no live consumer after home page rewrite):

| File | Reason for deletion |
|---|---|
| `components/AgentResponseBubble.tsx` | Spec decision 7; replaced by Flow Registry |
| `components/AgentStep.tsx` | Only imported by `AgentResponseBubble` |
| `components/ChatMessage.tsx` | Only imported by `home/page.tsx` (rewritten) |
| `components/home-empty-state.tsx` | Spec decision 7; replaced by `HomeIdle` |
| `components/EmptyState.tsx` | No live consumer in any route |
| `components/LoadingState.tsx` | No live consumer; uses `react-i18next` (wrong library) |
| `components/ReasoningBlock.tsx` | Only imported by `PlaceCard.tsx` |
| `components/PlaceCard.tsx` | Only imported by `AgentResponseBubble.tsx` |

**Keep** (still used): `ChatInput.tsx` (modified), `NavBar.tsx`, `profile-menu.tsx`, `language-switcher.tsx`, `locale-html-attrs.tsx`, `nav-link.tsx`, `theme-toggle.tsx`, `ThemeToggle.tsx`, `KebiAvatar.tsx`, `PastePreview.tsx`, `PasteIndicator.tsx`, `Modal.tsx`, `add-place-modal.tsx`, `illustrations/kebi-app-illustrations.tsx`.

---

## Phase 1: Design & Contracts

### data-model.md — Key types

All new shared types go in `libs/shared/src/lib/types.ts`. App-local types (`HomePhase`, `HomeState`, `FlowDefinition`) stay in `apps/web`.

**Additions to `libs/shared/src/lib/types.ts`**:

```ts
// Typed subtypes for ChatResponseDto.data
export interface ReasoningStep {
  step: string;
  summary: string;
}

export interface ConsultPlace {
  place_name: string;
  address: string;
  reasoning: string;
  source: 'saved' | 'discovered';
  photos?: { hero?: string; square?: string };
}

export interface ConsultResponseData {
  primary: ConsultPlace;
  alternatives: ConsultPlace[];
  reasoning_steps: ReasoningStep[];
  context_chips?: string[];
}

export interface RecallItem {
  place_id: string;
  place_name: string;
  address: string;
  cuisine: string | null;
  price_range: string | null;
  source_url: string | null;
  saved_at: string;
  match_reason: string;
}

export interface RecallResponseData {
  results: RecallItem[];
  total: number;
}

export interface SavedPlaceStub {
  place_id: string;
  place_name: string;
  address: string;
  saved_at: string;
}

// Narrowed ChatResponseDto (replaces the loose Record<string,unknown>)
export type ChatResponseType =
  | 'consult'
  | 'recall'
  | 'extract-place'
  | 'assistant'
  | 'clarification'
  | 'error';

export interface ChatResponseDto {
  type: ChatResponseType;
  message: string;
  data: ConsultResponseData | RecallResponseData | Record<string, unknown> | null;
}

// ClientIntent — used by classifyIntent() in apps/web
export type ClientIntent = 'consult' | 'recall' | 'save' | 'assistant';
```

**App-local types** (`apps/web/src/store/home-store.ts`):

```ts
export type HomePhase =
  | 'hydrating' | 'cold-0' | 'cold-1-4' | 'taste-profile' | 'idle'
  | 'thinking' | 'result' | 'recall'
  | 'save-sheet' | 'save-snackbar' | 'save-duplicate'
  | 'assistant-reply' | 'starter-pack' | 'error';
```

### contracts/chat-client.md — Chat client interface

**File**: `apps/web/src/lib/chat-client.ts`

**Interface**:
```ts
interface ChatClientOptions {
  message: string;
  userId: string;
  location: { lat: number; lng: number } | null;
  signal?: AbortSignal;
}

interface ChatClient {
  chat(opts: ChatClientOptions): Promise<ChatResponseDto>;
}
```

**Implementations**:
- `realChatClient` — POSTs to `POST /api/v1/chat` via `FetchClient`, requires Clerk token via `getToken` callback
- `chatClientFixtures` — returns per-intent fixture; no network

**Selection**: `process.env.NEXT_PUBLIC_CHAT_FIXTURES === 'true'` → fixtures; else real.

**Token flow**: `HomePage` passes its Clerk `getToken` function into the store via `store.init({ getToken, userId })`. Store passes it to `realChatClient` on each call.

### Phase 1 — Implementation checklist

#### Step 1: Dependencies
- [ ] `pnpm add zustand@^5 zod@^3 --filter apps/web`

#### Step 2: Shared types update (`libs/shared/src/lib/types.ts`)
- [ ] Add `ReasoningStep`, `ConsultPlace`, `ConsultResponseData`, `RecallItem`, `RecallResponseData`, `SavedPlaceStub`, `ClientIntent`, `ChatResponseType`
- [ ] Narrow `ChatResponseDto.data` type
- [ ] Export all from `libs/shared/src/index.ts`

#### Step 3: Storage modules (`apps/web/src/storage/`)
- [ ] `saved-places-storage.ts` — `getSavedPlaces(): SavedPlaceStub[]`, `setSavedPlaces(places)`, `getSavedPlaceCount(): number`, `appendSavedPlace(place)`
- [ ] `taste-profile-storage.ts` — `getTasteProfileConfirmed(): boolean`, `setTasteProfileConfirmed()`
- [ ] `location-storage.ts` — `getLocation(): {lat,lng}|null`, `setLocation(loc)`
- All modules wrap localStorage in try/catch, return safe defaults on error

#### Step 4: Intent classifier (`apps/web/src/lib/classify-intent.ts`)
- [ ] `classifyIntent(message: string): ClientIntent`
- Rules: URL-like input → `'save'`; memory language pattern → `'recall'`; everything else → `'consult'`; `'assistant'` deferred to sub-plan 5 (classify as `'consult'` for now)

#### Step 5: Chat client (`apps/web/src/lib/chat-client.ts`)
- [ ] `ChatClient` interface
- [ ] `realChatClient(getToken)` — POSTs to `/api/v1/chat`, passes Clerk Bearer token
- [ ] `chatClientFixtures` — keyed by `ClientIntent`, returns canned `ChatResponseDto`
- [ ] Export `getChatClient(getToken)` — returns fixture or real based on env flag

#### Step 6: Constants (`apps/web/src/constants/`)
- [ ] `placeholders.ts` — `TASTE_MATCH_ARC_PLACEHOLDER = 78`, `COMMUNITY_PROOF_COUNT = 142`
- [ ] `home-suggestions.ts` — `CONSULT_SUGGESTIONS: string[]`, `TASTE_CHIP_BANK: string[]` (3 hardcoded chips)

#### Step 7: Flow Registry scaffold (`apps/web/src/flows/`)
- [ ] `flow-definition.ts` — `FlowDefinition<TData>` interface, `FlowId` union (all 5 IDs even if only consult is implemented)
- [ ] `registry.ts` — `FLOW_REGISTRY` with `satisfies` constraint; stub entries for recall/save/assistant/clarification (no-op Component, empty schema) so TypeScript coverage passes; consult entry populated in step 11

#### Step 8: Zustand store (`apps/web/src/store/home-store.ts`)
- [ ] `HomePhase` enum (13 values)
- [ ] `HomeState` interface (all fields from spec)
- [ ] `useHomeStore` — Zustand create() with:
  - `hydrate()` — reads storage modules, seeds count/confirmed/location, picks initial phase; respects `NEXT_PUBLIC_DEV_SAVED_COUNT` override (dev only)
  - `init({ getToken, userId })` — stores auth context for `submit()`
  - `setUserId(id)` — updates userId in store
  - `setLocation(loc)` — persists to storage + updates store
  - `submit(message, opts?)` — classifyIntent → pre-route → fetch → server correction → dispatch to flow's `onResponse`
  - `markAnimationComplete()` — sets flag, calls `tryReveal()`
  - `confirmTasteProfile()` — writes storage, flips to `idle`
  - `reset()` — returns to correct resting phase based on `savedPlaceCount`
  - Stub actions for sub-plans 3-7: `submitRecall`, `openSaveSheet`, `confirmSave`, `dismissSaveSheet`, `dismissAssistantReply`, `incrementSavedCount` (all throw `NotImplementedError` until their sub-plan)

#### Step 9: Illustration aliases (`apps/web/src/components/illustrations/kebi-app-illustrations.tsx`)
- [ ] Add `KebiIdleWelcoming` alias → `kebi-app-home-input.svg`
- [ ] Add `KebiExcited` alias → `kebi-app-success.svg`
- [ ] Remove exports only used by deleted components

#### Step 10: Dead code deletion
- [ ] Delete: `AgentResponseBubble.tsx`, `AgentStep.tsx`, `ChatMessage.tsx`, `home-empty-state.tsx`, `EmptyState.tsx`, `LoadingState.tsx`, `ReasoningBlock.tsx`, `PlaceCard.tsx`
- [ ] Remove all unused imports in files that referenced deleted components
- [ ] Confirm `pnpm nx lint web` passes after deletions

#### Step 11: i18n restructure
- [ ] Add `consult.*` keys to `en.json` and `he.json` (Hebrew placeholder copies OK for now)
- [ ] Add `tasteProfile.*` keys
- [ ] Restructure/add `home.idle.*` keys
- [ ] Remove keys exclusively owned by deleted components
- [ ] Confirm no `useTranslations()` calls reference removed keys

#### Step 12: ChatInput simplification
- [ ] Remove `value` state, replace submit handler to call `store.submit(value)`
- [ ] Rename `onSend` prop → `onSubmit`
- [ ] Keep all other state, markup, and styling unchanged

#### Step 13: Resting-state components (sub-plan 1)
- [ ] `components/home/HomeIdle.tsx` — `KebiIdleWelcoming` illustration, headline, 3 suggestion chips from `CONSULT_SUGGESTIONS`
- [ ] `components/home/HomeGreeting.tsx` — greeting text visible on `idle`/`cold-0`/`cold-1-4` phases
- [ ] `components/layout/ClarificationHint.tsx` — scaffold only; renders `null` until store has `clarificationMessage`

#### Step 14: Flow 2 — Consult flow (`apps/web/src/flows/consult/`)
- [ ] `consult.constants.ts` — `FLOW_2_STEPS` array, timing arrays (`STEP_OFFSETS`, `STEP_DURATIONS`)
- [ ] `consult.schema.ts` — `ConsultResponseDataSchema` (Zod schema matching `ConsultResponseData`)
- [ ] `consult.fixtures.ts` — `consultFixture(req)` returns realistic `ChatResponseDto` with 6 `reasoning_steps`
- [ ] `ConsultThinking.tsx` — 6 steps, `setTimeout` schedule, skeleton at 2200ms, `onAnimationComplete` at 4100ms
- [ ] `TasteMatchArc.tsx` — 44×44 SVG radial progress, placeholder value from `placeholders.ts`
- [ ] `CommunityProofLine.tsx` — italic muted line, placeholder count
- [ ] `PrimaryResultCard.tsx` — hero photo, name, context pills, reasoning block (gold border `#c8890a` / warm bg `#f5ead8` + `TODO: tokenize`), source attribution, action row; entry scale animation
- [ ] `AlternativeCard.tsx` — small photo, name, subline; slide-in 400ms after primary
- [ ] `ConsultResult.tsx` — composes the above
- [ ] `index.ts` — exports `consultFlow: FlowDefinition<ConsultResponseData>`
- [ ] Register `consultFlow` in `registry.ts` (replace stub entry)

#### Step 15: Flow 9 — Taste Profile (`apps/web/src/components/home/TasteProfileCelebration.tsx`)
- [ ] Three chips with `pending | confirmed | dismissed` local state
- [ ] Confirmed: bg `#d8ecc8` / fg `#3a6018` / border `#b0d090` + `TODO: tokenize`
- [ ] Dismissed: 25% opacity
- [ ] "Start exploring" CTA → `store.confirmTasteProfile()`
- [ ] `KebiExcited` illustration

#### Step 16: ConsultError (`apps/web/src/components/home/ConsultError.tsx`)
- [ ] `KebiIdleWelcoming` illustration, error category headline/body from `flow2.error.*` i18n, "Try again" button → `store.reset()`

#### Step 17: Home page rewrite (`apps/web/src/app/[locale]/(main)/home/page.tsx`)
- [ ] Three-layer layout: NavBar / message area (flex-1, scrollable) / input bar (always mounted)
- [ ] `useEffect` → `store.hydrate()` + `store.init({ getToken, userId })`
- [ ] `useMemo` content switch: resting phases via switch, flow states via `FLOW_REGISTRY[activeFlowId].Component`
- [ ] `ClarificationHint` orthogonal slot above input bar
- [ ] `SavedSnackbar` stub (phase `save-snackbar` renders nothing for now)
- [ ] `HomeGreeting` orthogonal slot

#### Step 18: Verification
- [ ] `NEXT_PUBLIC_DEV_SAVED_COUNT=0` → renders `cold-0` (HomeIdle shows)
- [ ] `NEXT_PUBLIC_DEV_SAVED_COUNT=3` → renders `cold-1-4`
- [ ] `NEXT_PUBLIC_DEV_SAVED_COUNT=5` (unconfirmed) → renders `taste-profile`; "Start exploring" → `idle`
- [ ] `NEXT_PUBLIC_DEV_SAVED_COUNT=12` → renders `idle`
- [ ] `NEXT_PUBLIC_CHAT_FIXTURES=true` + consult query → thinking animation runs, result card reveals at ≥4100ms
- [ ] `pnpm nx lint web` passes with zero errors
- [ ] `pnpm nx build web` passes

---

## Complexity Tracking

*No constitution violations. Table omitted.*
