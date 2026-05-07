# Data Model: Home Page Infrastructure, Flow 2 & Flow 9

**Feature**: `001-home-infra-flow2-flow9`  
**Date**: 2026-04-11

## Shared Types (`libs/shared/src/lib/types.ts`)

### Existing (modified)

```ts
// ChatResponseDto.data is narrowed from Record<string,unknown>|null
export interface ChatResponseDto {
  type: ChatResponseType;
  message: string;
  data: ConsultResponseData | RecallResponseData | Record<string, unknown> | null;
}

export type ChatResponseType =
  | 'consult' | 'recall' | 'extract-place'
  | 'assistant' | 'clarification' | 'error';
```

### New additions

```ts
export type ClientIntent = 'consult' | 'recall' | 'save' | 'assistant';

export interface ReasoningStep {
  step: string;     // e.g. "intent_parsing"
  summary: string;  // e.g. "Parsed: cuisine=ramen, area=Sukhumvit"
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
  context_chips?: string[];   // optional, backend may not populate yet
}

export interface RecallItem {
  place_id: string;
  place_name: string;
  address: string;
  cuisine: string | null;
  price_range: string | null;
  source_url: string | null;
  saved_at: string;           // ISO 8601
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
  saved_at: string;           // ISO 8601 — written by sub-plan 6 (Flow 4)
}
```

---

## App-local Types (`apps/web`)

### HomePhase (store/home-store.ts)

```ts
export type HomePhase =
  | 'hydrating'       // initial — before localStorage read
  | 'cold-0'          // Flow 7 — savedCount === 0
  | 'cold-1-4'        // Flow 8 — savedCount 1–4
  | 'taste-profile'   // Flow 9 — savedCount ≥ 5, unconfirmed
  | 'idle'            // savedCount ≥ 5, confirmed
  | 'thinking'        // Flow 2 — 6-step animation in flight
  | 'result'          // Flow 2 — primary + alternatives card
  | 'recall'          // Flow 3 — results cascade
  | 'save-sheet'      // Flow 4 — half-sheet overlay
  | 'save-snackbar'   // Flow 4 — success toast
  | 'save-duplicate'  // Flow 4 — knowing variant
  | 'assistant-reply' // Flow 11 — text bubble
  | 'starter-pack'    // Flow 8 sub-screen
  | 'error';
```

### HomeState (store/home-store.ts)

```ts
interface HomeState {
  // Phase
  phase: HomePhase;
  activeFlowId: FlowId | null;

  // Auth (seeded from Clerk via init())
  userId: string | null;
  getToken: (() => Promise<string>) | null;

  // Query state
  query: string | null;
  result: ConsultResponseData | null;
  reasoningSteps: ReasoningStep[];
  error: { message: string; category: 'offline' | 'timeout' | 'generic' | 'server' } | null;

  // Hydration
  hydrated: boolean;
  tasteProfileConfirmed: boolean;
  savedPlaceCount: number;

  // Location
  location: { lat: number; lng: number } | null;

  // Animation-fetch race
  animationComplete: boolean;
  fetchComplete: boolean;
  pendingResult: ConsultResponseData | null;
  pendingError: HomeState['error'];
  abortController: AbortController | null;

  // Flow-specific slots (stubbed until sub-plans 3–7)
  recallResults: RecallItem[] | null;
  recallHasMore: boolean;
  saveSheetPlace: SavedPlaceStub | null;
  saveSheetStatus: 'pending' | 'saving' | 'duplicate' | 'error';
  saveSheetOriginalSavedAt: string | null;
  assistantMessage: string | null;
  clarificationMessage: string | null;

  // Actions (implemented in this task)
  hydrate: () => void;
  init: (opts: { userId: string | null; getToken: () => Promise<string> }) => void;
  setUserId: (id: string | null) => void;
  setLocation: (loc: { lat: number; lng: number } | null) => void;
  submit: (message: string, opts?: { forceIntent?: ClientIntent }) => Promise<void>;
  markAnimationComplete: () => void;
  confirmTasteProfile: () => void;
  reset: () => void;

  // Actions stubbed until sub-plans 3–7
  submitRecall: (message: string) => Promise<void>;
  openSaveSheet: (message: string) => void;
  confirmSave: () => Promise<void>;
  dismissSaveSheet: () => void;
  dismissAssistantReply: () => void;
  incrementSavedCount: (place: SavedPlaceStub) => void;
  setPendingResult: (data: ConsultResponseData) => void;
  tryRevealResult: () => void;
}
```

### FlowDefinition (flows/flow-definition.ts)

```ts
export type FlowId = 'consult' | 'recall' | 'save' | 'assistant' | 'clarification';

export interface FlowDefinition<TData = unknown> {
  id: FlowId;
  matches: {
    clientIntent?: ClientIntent;
    responseType: ChatResponseType;
  };
  phase: HomePhase;
  inputPlaceholderKey: string;
  schema: ZodSchema<TData>;
  fixture: (req: ChatRequestDto) => Promise<ChatResponseDto>;
  onResponse: (res: ChatResponseDto, store: HomeStoreApi) => void;
  Component: ComponentType<{ store: HomeStoreApi }>;
}
```

---

## localStorage Schema

| Key | Type | Owner |
|-----|------|-------|
| `localStorage.kebi-app.savedPlaces` | `SavedPlaceStub[]` (JSON) | `saved-places-storage.ts` |
| `localStorage.kebi-app.tasteProfile` | `{ confirmed: boolean }` (JSON) | `taste-profile-storage.ts` |
| `localStorage.kebi-app.location` | `{ lat: number; lng: number }` (JSON) | `location-storage.ts` |

All keys are namespaced under `kebi-app.*`. All reads are wrapped in try/catch with safe defaults.

---

## State Transitions

```
[hydrating]
    │ hydrate() reads localStorage
    ├── savedCount === 0 ──────────────────────────────► [cold-0]
    ├── savedCount 1–4 ─────────────────────────────────► [cold-1-4]
    ├── savedCount ≥ 5 && !confirmed ───────────────────► [taste-profile]
    └── savedCount ≥ 5 && confirmed ────────────────────► [idle]

[idle | cold-0 | cold-1-4 | taste-profile]
    │ submit(consult)
    └──► [thinking] ──── animation (4100ms) + fetch ────► [result] or [error]

[taste-profile]
    │ confirmTasteProfile()
    └──► [idle]

[thinking | result | error]
    │ reset()
    └──► [cold-0 | cold-1-4 | idle]  (based on savedPlaceCount)
```
