# Implementation Plan: UI Alignment to PlaceObject Contract

**Branch**: `015-ui-align-placeobject` | **Date**: 2026-04-19 | **Spec**: [spec.md](./spec.md)

## Summary

Align `apps/web` with the updated `libs/shared` type contract. `libs/shared/src/lib/types.ts` already has all new types (`PlaceObject`, `ConsultResult`, `RecallResult`, `ExtractPlaceItem`, `ChipItem`, `SignalTier`, etc.) — the old types (`RecallItem`, `SaveExtractPlace`, `ConsultPlace`) are gone, so the store and several components already have TypeScript errors. This plan fixes those errors by rewriting schemas, fixtures, components, the Zustand store, and adding three new API client modules and four tier-gated UI components. No backend changes.

---

## Technical Context

**Language/Version**: TypeScript 5.x / Node 20 LTS  
**Primary Dependencies**: Next.js 16, React 19, Zustand, Zod, Tailwind v3, shadcn/ui, framer-motion v11 (installed), next-intl, Clerk v5  
**Storage**: localStorage only (`kebi-app.savedCount`, `kebi-app.savedPlaces`)  
**Testing**: `pnpm nx lint web`, `pnpm nx typecheck web`, `pnpm nx build web`, browser smoke  
**Target Platform**: Browser + Capacitor iOS shell  
**Project Type**: Next.js App Router SPA (client-heavy home page)  
**Performance Goals**: PlaceCard expand animation < 300ms  
**Constraints**: No new packages. Fixture mode must work offline. `provider_id` Google prefix must be stripped for Maps URL.  
**Scale/Scope**: `apps/web` only — 8 phases, ~23 files

---

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| §I Two-repo boundary | ✅ PASS | `apps/web` only. No NestJS changes, no AI logic. |
| §II Nx module boundaries | ✅ PASS | `apps/web` imports `@kebi-app/shared` and `@kebi-app/ui` only. New clients live in `apps/web/src/lib/`. |
| §III ADR constraints | ✅ PASS | ADR-029 (FetchClient transport) followed for new API clients. ADR-007 (Tailwind v3) respected in all components. ADR-036 (single /v1/chat endpoint) unchanged. |
| §IV Config rules | ✅ PASS | Fixture mode via existing `NEXT_PUBLIC_CHAT_FIXTURES` env flag. No new hardcoded values. |
| §V DB write ownership | ✅ PASS | No DB writes from frontend. |
| §VII Frontend standards | ✅ PASS | Semantic tokens only, logical RTL properties, next-intl for all UI strings, `cn()` for class merging. |
| §VIII Code standards | ✅ PASS | Kebab-case files, PascalCase components, no type duplication. |
| §X Required skills | ✅ PASS | `nextjs16-skills` + `vercel-react-best-practices` invoked before planning. |

---

## Project Structure

### Documentation (this feature)

```text
specs/015-ui-align-placeobject/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
└── tasks.md             ← /speckit.tasks output (not created here)
```

### Source Code

```text
apps/web/src/
├── lib/
│   ├── place-schema.ts          NEW   Zod schema for PlaceObject
│   ├── signal-client.ts         NEW   POST /api/v1/signal wrapper
│   ├── user-context-client.ts   NEW   GET /api/v1/user/context wrapper
│   ├── cold-suggestions.ts      NEW   Hardcoded placeholder PlaceObjects
│   └── chat-client.ts           MOD   Add signal_tier param
├── components/
│   ├── PlaceCard.tsx             NEW   Unified place card component
│   └── home/
│       ├── ChipSelectionBoard.tsx   NEW
│       ├── TasteChipsSidebar.tsx    NEW
│       └── SavedProgressNudge.tsx   NEW
├── flows/
│   ├── consult/
│   │   ├── consult.schema.ts    MOD   Rewrite to new shape
│   │   ├── consult.fixtures.ts  MOD   Rebuild with PlaceObject
│   │   ├── ConsultResult.tsx    MOD   Use PlaceCard
│   │   ├── PrimaryResultCard.tsx  DEL
│   │   └── AlternativeCard.tsx    DEL
│   ├── recall/
│   │   ├── index.tsx            MOD   Strict Zod + new onResponse
│   │   ├── recall.fixtures.ts   MOD   Rebuild with PlaceObject
│   │   ├── RecallResults.tsx    MOD   Use PlaceCard
│   │   └── RecallResultBubble  via components/home/RecallResultBubble.tsx  MOD
│   ├── save/
│   │   ├── save.schema.ts       MOD   Strict schema
│   │   ├── save.fixtures.ts     MOD   Rebuild with PlaceObject
│   │   ├── index.ts             MOD   Remove normalization
│   │   ├── SaveSheet.tsx        MOD   Use PlaceCard
│   │   └── SaveFlow.tsx         MOD   Update types
│   └── flow-definition.ts       MOD   Add 'chip-selection' to HomePhase
├── store/
│   └── home-store.ts            MOD   Major rewrite (Phase 6)
└── app/[locale]/(main)/home/page.tsx  MOD  Phase routing + loadUserContext
```

---

## Phase 0: Research

No open unknowns. All design decisions are locked in the spec (2026-04-18-ui-align-placeobject.md). Key confirmed facts from codebase inspection:

- `framer-motion` is installed (used in `SaveSheet.tsx`, `RecallResults.tsx`)
- `FetchClient` at `apps/web/src/api/transports/fetch.transport.ts` supports `get<T>` and `post<T>` — new clients follow this pattern
- `PlaceAvatar` at `apps/web/src/components/PlaceAvatar.tsx` uses `boring-avatars` with 5 warm palette colors — PlaceCard reuses it
- `provider_id` contract value is `"google:ChIJ..."` — strip the `"google:"` prefix before inserting as `query_place_id` in the Maps URL; other provider prefixes pass through as-is
- The `NEXT_PUBLIC_CHAT_FIXTURES` env flag already controls the fixture path in `chat-client.ts` — new clients follow the same gate
- `HomePhase` union lives in `apps/web/src/flows/flow-definition.ts:13` — add `'chip-selection'` here
- `home/page.tsx` switch on `store.phase` at line 94 — add `chip-selection` case here
- `store.hydrate()` + `store.init()` are called on mount in `home/page.tsx:57` — `loadUserContext()` is called after `init()` in Phase 6/7
- The recall `onResponse` currently normalizes old field names manually — Phase 3 replaces with strict Zod parse
- `SaveSheet.tsx` auto-saves high-confidence places by checking `confidence >= 0.7` — Phase 4 replaces with `status === 'saved'`
- `RecallResultBubble` uses `data.has_more` and `data.total` (old fields) — Phase 3 switches to `total_count` / `empty_state`

---

## Phase 1: New Primitives

### 1.1 `apps/web/src/lib/place-schema.ts` (NEW)

Zod schema for `PlaceObject` that stays in sync with the shared type via `satisfies`.

```typescript
// Structure
const PlaceLocationContextSchema = z.object({ neighborhood, city, country })
const PlaceAttributesSchema = z.object({ cuisine, price_hint, ambiance, dietary, good_for, location_context })
const PlaceHoursSchema = z.object({ sunday..saturday (optional), timezone })
const PlaceObjectSchema = z.object({
  // Tier 1 (always present)
  place_id, place_name, place_type, subcategory, tags, attributes,
  source_url, source, provider_id, created_at,
  // Tier 2
  lat, lng, address, geo_fresh,
  // Tier 3
  hours, rating, phone, photo_url, popularity, enriched,
}) satisfies z.ZodType<PlaceObject>
```

Export: `PlaceObjectSchema`.

### 1.2 `apps/web/src/components/PlaceCard.tsx` (NEW)

Unified presentational card. No data fetching. No flow-specific logic.

**Props:**
```typescript
interface PlaceCardProps {
  place: PlaceObject;
  expanded?: boolean;        // controlled
  defaultExpanded?: boolean; // uncontrolled
  onToggle?: (next: boolean) => void;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}
```

**Collapsed state** (160×160 square, `rounded-2xl`):
- `photo_url` → `<img>` with `object-cover`; fallback → `<PlaceAvatar name={place.place_name} size={160} />`
- Overlay at bottom: `place_name` (white semibold), `subcategory ?? attributes.cuisine` (muted xs), price dots from `attributes.price_hint` (`$`=1 dot, `$$`=2, `$$$`=3)
- `badge` slot top-end corner
- tap → toggle expanded

**Expanded state** (below collapsed content, `AnimatePresence`):
- Always: `tags` as chip pills, `attributes.cuisine`, `attributes.ambiance`, `attributes.dietary[]`, `attributes.good_for[]`, `attributes.location_context.neighborhood + city`
- Tier 2 guard (`place.geo_fresh || place.lat != null`): `address`
- Tier 3 guard (`place.enriched`): rating stars, hours open-now summary (is today's hours range including "Open now" / "Closed"), `phone`, popularity bar
- Map button (when `place.provider_id !== null`):
  ```typescript
  // Strip namespace prefix: "google:ChIJ..." → "ChIJ..."
  const rawId = place.provider_id.includes(':')
    ? place.provider_id.split(':').slice(1).join(':')
    : place.provider_id;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.place_name)}&query_place_id=${encodeURIComponent(rawId)}`;
  // Opens in new tab: target="_blank" rel="noopener noreferrer"
  ```
- `action` slot at bottom

**Animation**: `motion.div` with `layout` prop on root, `AnimatePresence` around expanded body (fade in/out via `initial={{ opacity:0 }}` / `exit={{ opacity:0 }}`).

**i18n**: all button labels (map, expand/collapse) via `useTranslations('placeCard')`.

**Translation keys to add** in `apps/web/messages/en.json`:
```json
"placeCard": {
  "openMap": "Open in Maps",
  "expand": "See more",
  "collapse": "See less",
  "openNow": "Open now",
  "closed": "Closed"
}
```

---

## Phase 2: Consult Flow

### 2.1 `apps/web/src/flows/consult/consult.schema.ts` (REWRITE)

```typescript
const ConsultResultSchema = z.object({
  place: PlaceObjectSchema,
  source: z.enum(['saved', 'discovered']),
})
const ReasoningStepSchema = z.object({ step: z.string(), summary: z.string() })
export const ConsultResponseDataSchema = z.object({
  recommendation_id: z.string().nullable(),
  results: z.array(ConsultResultSchema),
  reasoning_steps: z.array(ReasoningStepSchema),
}) satisfies z.ZodType<ConsultResponseData>
```

### 2.2 `apps/web/src/flows/consult/consult.fixtures.ts` (REWRITE)

Return full `ConsultResponseData` with `recommendation_id`, `results[]` (1 primary + 2 alternatives), each with a complete `PlaceObject` (Tier 1 always, Tier 3 populated to demo enrichment). Use `place_id: 'pl_fuji_ramen'` etc.

### 2.3 `apps/web/src/flows/consult/ConsultResult.tsx` (REWRITE)

```typescript
// result is now ConsultResponseData
// result.results[0] → primary PlaceCard (defaultExpanded)
// result.results.slice(1) → grid of collapsed PlaceCards
// action slot: AcceptButton / RejectButton — calls store.acceptPlace / store.rejectPlace
// Keep TasteMatchArc as sibling decoration below primary card
// Keep CommunityProofLine as sibling decoration
```

The `action` slot for the primary PlaceCard:
```typescript
<div className="flex gap-2">
  <button onClick={() => store.acceptPlace(result.recommendation_id!, place.place_id)}>Accept</button>
  <button onClick={() => store.rejectPlace(result.recommendation_id!, place.place_id)}>Reject</button>
</div>
```
Store actions are fire-and-forget; no loading state in UI.

Translation keys: `consult.result.actions.accept`, `consult.result.actions.reject` (add to `en.json`).

### 2.4 Delete `PrimaryResultCard.tsx` and `AlternativeCard.tsx`

Remove files. `ConsultResult.tsx` no longer imports them.

---

## Phase 3: Recall Flow

### 3.1 `apps/web/src/flows/recall/index.tsx` (REWRITE)

Replace loose schema + manual normalization with strict Zod parse:

```typescript
const RecallResultSchema = z.object({
  place: PlaceObjectSchema,
  match_reason: z.enum(['filter','semantic','keyword','semantic + keyword']),
  relevance_score: z.number().nullable(),
  score_type: z.enum(['rrf','ts_rank']).nullable(),
})
const RecallResponseDataSchema = z.object({
  results: z.array(RecallResultSchema),
  total_count: z.number(),
  empty_state: z.boolean(),
}) satisfies z.ZodType<RecallResponseData>
```

`onResponse`: parse data with new schema; call `store.pushRecallResults(res.message, parsed)` on success; on empty_state push message only; on parse failure push error message.

### 3.2 `apps/web/src/flows/recall/recall.fixtures.ts` (REWRITE)

Return `RecallResponseData` with `results[]` using full `PlaceObject` + `match_reason` + `total_count` + `empty_state`. Three fixture scenarios keyed by message (ramen, cafe, Japanese) + empty fallback.

### 3.3 `apps/web/src/flows/recall/RecallResults.tsx` (REWRITE)

Replace `RecallResultCard` (flat fields) with:
```typescript
{results.map((r) => (
  <PlaceCard
    key={r.place.place_id}
    place={r.place}
    badge={<MatchReasonBadge reason={r.match_reason} />}
  />
))}
```
`MatchReasonBadge`: small muted pill with raw enum string.

Swap `hasMore` for derived `total_count > results.length`; swap `has_more` hint for "Showing N of M saved places".

### 3.4 `apps/web/src/components/home/RecallResultBubble.tsx` (REWRITE)

Replace `RecallCard` (uses `RecallItem` flat fields) with `PlaceCard`. Change `data.has_more` → `total_count > results.length`, `data.total` → `data.total_count`.

---

## Phase 4: Save Flow

### 4.1 `apps/web/src/flows/save/save.schema.ts` (REWRITE)

```typescript
const ExtractPlaceItemSchema = z.object({
  place: PlaceObjectSchema.nullable(),
  confidence: z.number().nullable(),
  status: z.enum(['saved','needs_review','duplicate','pending','failed']),
}) satisfies z.ZodType<ExtractPlaceItem>

export const ExtractPlaceDataSchema = z.object({
  results: z.array(ExtractPlaceItemSchema),
  source_url: z.string().nullable(),
  request_id: z.string().nullable(),
}) satisfies z.ZodType<ExtractPlaceData>
```

### 4.2 `apps/web/src/flows/save/save.fixtures.ts` (REWRITE)

Four scenarios:
- `sushi sora` → `[{ place: PlaceObject, confidence: 0.94, status: 'saved' }]`
- `tiktok.com` → `[{ place: PlaceObject, confidence: 0.91, status: 'saved' }]`
- `coffee` or `cafe` → two items: `{ confidence: 0.62, status: 'needs_review' }` + `{ confidence: 0.55, status: 'needs_review' }`
- default → `[{ place: null, confidence: 0.45, status: 'pending' }]`

Each `place` is a full `PlaceObject` (Tier 1 fields, `geo_fresh: false`, `enriched: false`).

### 4.3 `apps/web/src/flows/save/index.ts` (REWRITE `onResponse`)

Remove manual normalization. Use `ExtractPlaceDataSchema.parse(res.data)`. Call `store.openSaveSheet(store.query || '', data.results, data.source_url)`.

### 4.4 `apps/web/src/flows/save/SaveSheet.tsx` (REWRITE)

New `SavePlaceCard` receives `ExtractPlaceItem`:
- If `item.place !== null` → `<PlaceCard place={item.place} badge={<ConfidencePill item={item} />} action={<StatusButton item={item} onSave={onSave} />} />`
- If `item.place === null` → excluded from card grid

Summary lines above card grid (only when counts > 0):
```typescript
const pendingCount = items.filter(i => i.place === null && i.status === 'pending').length;
const failedCount  = items.filter(i => i.place === null && i.status === 'failed').length;
```

Auto-save rule: `status === 'saved'` (replaces old `confidence >= 0.7 && status !== 'unresolved'`).

`ConfidencePill`: muted pill showing `{Math.round(confidence * 100)}%` when `status === 'needs_review'`; `"Saved"` green badge for `saved`; `"Duplicate"` amber badge for `duplicate`.

`StatusButton`: `"+ Save"` for `needs_review`; hidden for `saved`/`duplicate`/`pending`/`failed`.

### 4.5 `apps/web/src/flows/save/SaveFlow.tsx` (update types)

Change `SaveExtractPlace` → `ExtractPlaceItem` in the `places` prop and callback signatures.

### 4.6 `apps/web/src/components/home/SaveResultBubble.tsx` (REWRITE)

Receive `item: ExtractPlaceItem` + `sourceUrl`. When `item.place !== null`:
```typescript
<PlaceCard place={item.place} badge={<SavedChip />} />
```
When `item.place === null` (defensive guard): single-line fallback "Place saved" + `sourceUrl`.

---

## Phase 5: New API Clients

### 5.1 `apps/web/src/lib/signal-client.ts` (NEW)

```typescript
// Follows FetchClient pattern (ADR-029)
export interface SignalClient {
  acceptRecommendation(recommendationId: string, placeId: string): Promise<void>;
  rejectRecommendation(recommendationId: string, placeId: string): Promise<void>;
  confirmChips(chips: ChipItem[]): Promise<void>;
}

function makeRealSignalClient(getToken: () => Promise<string>): SignalClient { ... }

const fixtureSignalClient: SignalClient = {
  // Resolves immediately — no network call
  acceptRecommendation: async () => {},
  rejectRecommendation: async () => {},
  confirmChips: async () => {},
};

export function getSignalClient(getToken: () => Promise<string>): SignalClient {
  if (process.env.NEXT_PUBLIC_CHAT_FIXTURES === 'true') return fixtureSignalClient;
  return makeRealSignalClient(getToken);
}
```

Real implementation: `POST /api/v1/signal`. Resolves on 2xx. Swallows 404 with `console.warn`. Rethrows network errors only. No retry.

### 5.2 `apps/web/src/lib/user-context-client.ts` (NEW)

```typescript
export interface UserContextClient {
  getUserContext(): Promise<UserContextResponse>;
}

// Fixture default:
const fixtureResponse: UserContextResponse = {
  saved_places_count: 0,
  signal_tier: 'active',
  chips: [],
};
```

Real implementation: `GET /api/v1/user/context?user_id={userId}`. Uses `FetchClient.get<UserContextResponse>`. Throws on HTTP error.

### 5.3 `apps/web/src/lib/cold-suggestions.ts` (NEW)

```typescript
// PLACEHOLDER — hardcoded until a suggestions endpoint exists.
import type { PlaceObject } from '@kebi-app/shared';

export const COLD_SUGGESTIONS: PlaceObject[] = [
  // 6–8 entries, all Tier 1 only, geo_fresh: false, enriched: false
  {
    place_id: 'cold-suggestion-1',
    place_name: 'Nara Eatery',
    place_type: 'food_and_drink',
    subcategory: 'restaurant',
    tags: ['ramen', 'late_night'],
    attributes: { cuisine: 'japanese', price_hint: '$$', ambiance: 'casual', dietary: [], good_for: [], location_context: null },
    source_url: null, source: null, provider_id: null, created_at: null,
    lat: null, lng: null, address: null, geo_fresh: false,
    hours: null, rating: null, phone: null, photo_url: null, popularity: null, enriched: false,
  },
  // ... 5-7 more
];
```

---

## Phase 6: Consolidated Store Rewrite

**One pass on `apps/web/src/store/home-store.ts`.** All type errors resolve here.

### Import changes

Remove: `RecallItem`, `SaveExtractPlace`, `SaveSheetPlace`  
Add: `RecallResult`, `RecallResponseData`, `ExtractPlaceItem`, `ExtractPlaceData`, `SignalTier`, `ChipItem`, `UserContextResponse`

### State additions / removals

| Remove | Add |
|--------|-----|
| `recallResults: RecallItem[] \| null` | `recallResults: RecallResult[] \| null` |
| `recallHasMore: boolean` | `recallTotalCount: number` |
| `saveSheetPlaces: SaveExtractPlace[]` | `saveSheetPlaces: ExtractPlaceItem[]` |
| — | `signalTier: SignalTier \| null` |
| — | `chips: ChipItem[]` |
| — | `savedPlacesCountFromContext: number \| null` |
| — | `saveSheetSourceUrl: string \| null` |

Also add `perPlaceDecisions: Record<string, 'accepted' \| 'rejected'>` to the `consult` variant of `ThreadEntry`.

### `pickRestingPhase` rewrite (tier-first)

```typescript
function pickRestingPhase(
  savedPlaceCount: number,
  tasteProfileConfirmed: boolean,
  signalTier: SignalTier | null,
): HomePhase {
  if (signalTier === 'cold') return 'cold-0';
  if (signalTier === 'chip_selection') return 'chip-selection';
  if (signalTier === 'warming' || signalTier === 'active') return 'idle';
  // null fallback — count-based
  if (savedPlaceCount === 0) return 'cold-0';
  if (savedPlaceCount < 5) return 'cold-1-4';
  if (!tasteProfileConfirmed) return 'taste-profile';
  return 'idle';
}
```

### `submit()` tier guards (add at top of submit)

```typescript
const { signalTier } = get();
if (signalTier === 'cold' || signalTier === 'chip_selection') {
  const isNonSaveIntent = intent !== 'save';
  if (isNonSaveIntent) {
    // Push clarification entry, no HTTP call
    const entry: ThreadEntry = { id: nextId(), role: 'assistant', type: 'clarification', message: t('tierGate.finishSetup') };
    set({ thread: [...get().thread, entry], phase: pickRestingPhase(...), activeFlowId: null });
    return;
  }
}
```

Also add `signal_tier: get().signalTier` to the `client.chat()` call body.

### Action signature changes

- `openSaveSheet(message, items: ExtractPlaceItem[], sourceUrl: string | null)` — add `sourceUrl` param
- `saveIndividualFromSheet(item: ExtractPlaceItem)` — build `SavedPlaceStub` from `item.place.place_id`, `.place_name`, `.address ?? ''`, `.photo_url`
- `closeSaveSheetWithResults(savedItems: ExtractPlaceItem[])` — update `ThreadEntry` save variant
- `autoSavePlace(item: ExtractPlaceItem, sourceUrl: string | null)` — same shape update
- `incrementSavedCount`: build stub from `place.place_id`, `.place_name`, `.address ?? ''`, `.photo_url ?? undefined`

### New actions

**`loadUserContext(): Promise<void>`**
```typescript
loadUserContext: async () => {
  const { userId, getToken, savedPlaceCount, tasteProfileConfirmed } = get();
  try {
    const client = getUserContextClient(userId ?? '', getToken ?? (async () => ''));
    const ctx = await client.getUserContext();
    const signalTier = ctx.signal_tier;
    const phase = pickRestingPhase(savedPlaceCount, tasteProfileConfirmed, signalTier);
    set({
      signalTier,
      chips: ctx.chips,
      savedPlacesCountFromContext: ctx.saved_places_count,
      phase,
    });
  } catch {
    // Silently fall back — pickRestingPhase uses count-based when signalTier is null
  }
},
```

Called from `init()` (after setting userId/getToken), after `incrementSavedCount`, after `confirmChips`.

**`acceptPlace(recommendationId, placeId): Promise<void>`**  
Calls `signalClient.acceptRecommendation(...)`. Fire-and-forget. Updates `perPlaceDecisions` on matching consult thread entry.

**`rejectPlace(recommendationId, placeId): Promise<void>`**  
Same shape as `acceptPlace`.

**`confirmChips(decidedChips: ChipItem[]): Promise<void>`**  
Calls `signalClient.confirmChips(decidedChips)`. Optimistically updates `chips` local state. Then calls `loadUserContext()`.

### `submitRecall` update

Replace `data.results` normalization with direct use of `RecallResult[]` from new store type. Replace `data.has_more` with `data.total_count > data.results.length`.

### `confirmSave` cleanup

Remove old `extraction_status` mapping. Use `item.status === 'saved'` for auto-save detection.

---

## Phase 7: Tier-Gated UI

### 7.1 `apps/web/src/flows/flow-definition.ts` (ADD `'chip-selection'` to `HomePhase`)

```typescript
export type HomePhase =
  | 'hydrating'
  | 'cold-0'
  | 'cold-1-4'
  | 'chip-selection'   // NEW
  | 'taste-profile'
  | 'idle'
  | 'thinking'
  | 'result'
  | 'recall'
  | 'save-sheet'
  | 'save-snackbar'
  | 'save-duplicate'
  | 'assistant-reply'
  | 'error';
```

### 7.2 `apps/web/src/components/home/ChipSelectionBoard.tsx` (NEW)

Props: `chips: ChipItem[], onConfirm: (chips: ChipItem[]) => void, onSkip: () => void`

```typescript
// Actionable filter per spec Decision 10:
const currentRound = chips.find(c => c.status === 'pending')?.selection_round;
const actionable = chips.filter(c => c.status === 'pending' && c.selection_round === currentRound);
const fromBefore  = chips.filter(c => !actionable.includes(c));
```

- Mobile: full-screen (`fixed inset-0`)
- Desktop (`md:`): centred modal (`max-w-lg mx-auto mt-16`)
- Actionable chips: 3-state pill toggles (`pending` → `confirmed` → `rejected` → `pending`)
- "From before" section (conditional): read-only confirmed/rejected + older pending chips
- Footer: "Done" button (disabled until at least one `actionable` chip changed from `pending`) + "Skip" button
- `onConfirm` fires with all chips that were touched (status changed from initial); `onSkip` closes without submission

All strings via `useTranslations('chipSelection')`. Add keys: `title`, `subtitle`, `fromBefore`, `done`, `skip`.

### 7.3 `apps/web/src/components/home/TasteChipsSidebar.tsx` (NEW)

Props: `chips: ChipItem[], tier: SignalTier`

- Desktop (`md:`): right rail `w-56 flex-shrink-0`, `sticky top-0`
- Mobile: bottom strip `fixed bottom-0` collapsible (collapsed by default, "Your taste" label toggle)
- Chips are always read-only (no tap handlers)
- `confirmed`: filled `bg-primary text-primary-foreground`
- `rejected`: muted `bg-muted text-muted-foreground line-through`
- `pending`: outline `border border-border text-foreground`
- Renders on `warming` and `active` tiers

### 7.4 `apps/web/src/components/home/SavedProgressNudge.tsx` (NEW)

Props: `count: number, tier: SignalTier`

- Returns `null` when `tier !== 'warming' || count >= 5`
- `"{count} of 5 saved"` label + `<div role="progressbar">` thin bar
- All strings via `useTranslations('savedProgress')`; add: `{ "label": "{count} of 5 saved" }`

### 7.5 `apps/web/src/lib/chat-client.ts` (ADD `signal_tier`)

```typescript
export interface ChatClientOptions {
  message: string;
  signal?: AbortSignal;
  signalTier?: SignalTier | null;   // NEW
}

// In makeRealChatClient.chat():
return await http.post<ChatResponseDto>(
  '/api/v1/chat',
  { message, ...(opts.signalTier != null ? { signal_tier: opts.signalTier } : {}) },
  signal,
);
```

Fixture client ignores `signalTier`.

### 7.6 `apps/web/src/app/[locale]/(main)/home/page.tsx` (PHASE ROUTING)

Add `chip-selection` to the phase switch:
```typescript
case 'chip-selection':
  return (
    <ChipSelectionBoard
      chips={store.chips}
      onConfirm={(chips) => store.confirmChips(chips)}
      onSkip={() => store.reset()}
    />
  );
```

Add `TasteChipsSidebar` alongside chat thread when `warming` or `active`:
```typescript
{(store.signalTier === 'warming' || store.signalTier === 'active') && (
  <TasteChipsSidebar chips={store.chips} tier={store.signalTier} />
)}
```

Add `SavedProgressNudge` when `warming`:
```typescript
{store.signalTier === 'warming' && (
  <SavedProgressNudge count={store.savedPlacesCountFromContext ?? store.savedPlaceCount} tier={store.signalTier} />
)}
```

Call `loadUserContext()` after `init()` in the `useEffect` mount block.

Also update `ColdStartZero.tsx` to render `COLD_SUGGESTIONS` as `<PlaceCard>` cards with a Save action each (extend existing component, do not replace).

### 7.7 `RESTING_PHASES` update in `home/page.tsx`

```typescript
const RESTING_PHASES: Set<string> = new Set(['idle', 'cold-0', 'cold-1-4', 'taste-profile', 'chip-selection']);
```

---

## Phase 8: Verify

```bash
pnpm nx lint web
pnpm nx typecheck web
pnpm nx build web
pnpm nx dev web
```

**Manual smoke checklist:**
- [ ] Fixture consult: PlaceCard renders collapsed/expanded correctly; Accept/Reject POST visible in network tab (202)
- [ ] Fixture recall: PlaceCard + match-reason badge; "Showing N of M" hint visible
- [ ] Fixture save (coffee): two `needs_review` PlaceCards + Confirm buttons; summary line for pending/failed items
- [ ] Fixture save (sushi sora): PlaceCard in saved state on mount
- [ ] PlaceCard map button: opens correct Google Maps URL; hidden when `provider_id === null`
- [ ] Cold tier: COLD_SUGGESTIONS render as PlaceCards with Save buttons
- [ ] Chip selection: board renders; "Done" disabled before toggle; submits on Done; skips on Skip
- [ ] Warming tier: TasteChipsSidebar visible; SavedProgressNudge visible with correct count
- [ ] Active tier: TasteChipsSidebar visible; SavedProgressNudge hidden
- [ ] Consult-intent in cold tier: no HTTP call, clarification message shown
- [ ] Network tab on any chat: `signal_tier` present in POST /api/v1/chat body

---

## Implementation Notes

1. **Phase ordering is strict**: Phase 1 (PlaceCard + schema) must land before Phases 2–4 consume it. Phase 5 (API clients) before Phase 6 (store). Phase 6 (store types) before Phase 7 (UI). Phases 2–4 can run in any order relative to each other.

2. **Intermediate TS errors are expected**: The plan doc's lock decision says "Phases 2–4 are written against the target store API; expect temporary TS errors until Phase 6 lands." Do not patch the store incrementally.

3. **`i18n` keys**: All new translation keys must be added to `apps/web/messages/en.json` in the same phase that introduces the component using them.

4. **`provider_id` prefix stripping**: The `"google:"` prefix must be stripped before inserting into the Maps URL. The split logic handles any future `"foursquare:"` or similar prefixes gracefully (split on `:`, take everything after the first segment).

5. **Fire-and-forget signals**: `acceptPlace` / `rejectPlace` / `confirmChips` must not block rendering. Use void-returning async functions called without await at the call site.

6. **Cold suggestions**: `COLD_SUGGESTIONS` must have the file header comment exactly as specified. It is explicitly a placeholder.
