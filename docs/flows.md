# Kebi Web App — Flow Reference

All implemented user flows as of branch `012-home-subplans-3-7`.

---

## State Machine Overview

Every interaction moves through a `HomePhase`. The store holds exactly one phase at a time.

| Phase | Meaning |
|---|---|
| `hydrating` | App loading, reading localStorage |
| `cold-0` | 0 saved places — new user |
| `cold-1-4` | 1–4 saved places — early user |
| `taste-profile` | 5+ saves, taste profile not confirmed |
| `idle` | 5+ saves, taste profile confirmed — ready for input |
| `thinking` | API call in flight |
| `recall` | Recall query in flight (breadcrumb timer active) |
| `save-sheet` | SaveSheet UI visible |
| `error` | Last request failed |

**Resting phases** (`idle`, `cold-0`, `cold-1-4`, `taste-profile`) show empty-state UI and flow-specific input placeholders.

---

## Thread Architecture

Every AI response is pushed as a `ThreadEntry` to the persistent thread. Entries are never removed except for error entries on retry.

```
ThreadEntry =
  | { role: 'user',      content: string }
  | { role: 'assistant', type: 'assistant',    message }
  | { role: 'assistant', type: 'clarification', message }
  | { role: 'assistant', type: 'consult',       message, data: ConsultResponseData }
  | { role: 'assistant', type: 'save',          place, sourceUrl }
  | { role: 'assistant', type: 'recall',        message, data: RecallResponseData }
  | { role: 'assistant', type: 'error',         category, flowId? }
```

---

## Flow 1 — Consult

**What it does:** Natural language recommendation ("cheap dinner nearby").

**Trigger:** User submits a query classified as `consult` intent.

**Phase path:** `thinking` → resting phase

**What the user sees:**
1. Input clears, thinking indicator appears ("Working on it…")
2. `ConsultThinking` — animated reasoning steps appear one by one as the API streams (intent_parsing → retrieval → discovery → validation → ranking → completion)
3. Once both API response and animation are done → `ConsultResult` is pushed to thread:
   - Primary result card: place name, address, reasoning (`bg-card` white)
   - Up to 2 alternative cards (`bg-card` white)
4. Phase resets to resting

**Thread entry pushed:** `type: 'consult'`

---

## Flow 2 — Save

**What it does:** Extract and save a place from a URL or free-text description.

**Trigger:** User submits text classified as `save` intent (URL, emoji-pin, place reference).

**Phase path:** `thinking` → `save-sheet` → resting phase

**What the user sees:**
1. Input clears, thinking indicator appears ("Looking up your place…")
2. API responds with place candidates:
   - If `provisional: true` → friendly message pushed to thread, sheet skipped
   - Otherwise → `SaveSheet` opens
3. `SaveSheet`:
   - Each card has a `PlaceAvatar` (marble avatar seeded by place name)
   - High-confidence places (≥70%) auto-marked Saved on open
   - Low-confidence places show an amber **Confirm** button
   - Each card saves inline on tap — button transitions to ✓ Saved badge, list stays open
   - **Done (N)** / **Cancel** button at top-right
4. On Done → one `SaveResultBubble` per saved place pushed to thread, phase resets
5. On Cancel → sheet closes, no thread entries, phase restores to pre-save state

**Thread entry pushed:** `type: 'save'` (one per saved place, on sheet close)

---

## Flow 3 — Recall

**What it does:** Search saved places by natural language memory ("that ramen place from TikTok").

**Trigger:** User submits a query classified as `recall` intent.

**Phase path:** `thinking` → resting phase

**What the user sees:**
1. Input clears, universal thinking indicator appears
2. API responds:
   - Results found → `RecallResultBubble` pushed to thread: list of place cards, each with a `PlaceAvatar` (marble, 48px), place name, cuisine/price/address, italic match reason, saved date
   - No results → plain assistant message pushed
3. Phase resets to resting

**Thread entry pushed:** `type: 'recall'`

---

## Flow 4 — Assistant / Clarification

**What it does:** General assistant reply or clarifying question from the AI.

**Trigger:** API returns `type: 'assistant'` or `type: 'clarification'`.

**Phase path:** `thinking` → resting phase

**What the user sees:**
- `AssistantBubble` pushed to thread — muted bubble with the AI's message
- Clarification bubbles use an amber tint to signal they need a follow-up

**Thread entry pushed:** `type: 'assistant'` or `type: 'clarification'`

---

## Flow 5 — Discovery

**What it does:** Show a browseable list of nearby places inline. Saves are silent — no thread bubble, no phase change.

**Trigger:** Programmatic — "City starter pack" button in ColdStartOneFour, or other in-app triggers.

**Phase path:** Stays in current resting phase (no API call)

**What the user sees:**
- `DiscoveryResults` appears in the scrollable area:
  - Title (the query), "One tap to save. Real places." subtitle
  - Cards: `PlaceAvatar` (marble), place name, cuisine · price · address, **+ Save** button
- Tapping Save → button animates to **✓ Saved** badge inline. No SaveSheet, no thread bubble.
- `saveQuiet` is called: saves to localStorage, increments count, no thread entry.

**Thread entries pushed:** None — discovery saves are fully silent.

---

## Empty State 1 — Cold Start (0 saves)

**Phase:** `cold-0`

**Trigger:** `savedPlaceCount === 0` on hydration.

**What the user sees** (`ColdStartZero`):
- Mascot illustration (raining), centered
- Headline: "Save places you love. / I'll figure out the rest." (`text-3xl`, `whitespace-pre-line`)
- Subtitle: "The easiest way to save is from TikTok or Instagram"
- 3 instructional step cards with gold/amber numbered badges (`bg-card` white):
  1. "Find a place on TikTok or Instagram" / "Any post, reel, or video mentioning a place"
  2. "Tap Share → Kebi" / "No need to open the app or copy any link"
  3. "I extract and save it automatically" / "Place name, location, and context — done"
- Paste hint: "or paste a link or type a name below"
- 2 quoted suggestion buttons (`bg-card` white):
  - `"Cheap dinner nearby, not crowded"`
  - `"Something romantic for tonight"`

**On button click:** `store.submit(suggestionText)` → enters save flow.

**Exits to:** `cold-1-4` after first save.

---

## Empty State 2 — Early User (1–4 saves)

**Phase:** `cold-1-4`

**Trigger:** `1 ≤ savedPlaceCount ≤ 4` on hydration.

**What the user sees** (`ColdStartOneFour`):
- **Kebi message bubble** — small encouraging illustration + chat bubble: "The more you save, the better I get." + subtitle
- **Saved places list** — up to 3 most recent saves from localStorage, each with `PlaceAvatar` + place name + source domain · city
- **"What's good nearby"** section:
  - Dashed amber-border card (`border-dashed border-accent/60 bg-accent/5`)
  - "Popular right now" label, place name, tags (cuisine · price · distance · Open now), italic save hint
- **Split action pill** — one rounded pill with a vertical divider:
  - Left: "Already have places saved?" → `store.submit('recall a saved place')`
  - Right: "City starter pack" (bold) → `store.setDiscoveryResults(...)` → Discovery inline

**Exits to:** `taste-profile` once `savedPlaceCount >= 5`.

---

## Empty State 3 — Taste Profile Celebration

**Phase:** `taste-profile`

**Trigger:** `savedPlaceCount >= 5` AND `tasteProfileConfirmed === false`.

**What the user sees** (`TasteProfileCelebration`):
- Celebratory mascot illustration
- Interactive taste chips — click to confirm or dismiss each tag
- **"Start exploring"** CTA button

**On CTA click:** `store.confirmTasteProfile()` → phase = `idle`, written to localStorage.

---

## Empty State 4 — Idle

**Phase:** `idle`

**Trigger:** `savedPlaceCount >= 5` AND `tasteProfileConfirmed === true`.

**What the user sees** (`HomeIdle`):
- Personalized greeting with user's first name
- Saved place count badge
- 4 consult suggestion chips

**On chip click:** `store.submit(suggestion)` → enters consult flow.

---

## Error Handling

**Trigger:** API returns an error, times out, or network is offline.

**Thread entry pushed:** `type: 'error'` with `category` (offline | timeout | server | generic) and `flowId` (save | consult).

**What the user sees:**
- `SaveError` (if `flowId === 'save'`) or `ConsultError` (all others) — rendered inline in thread
- Illustration + category-appropriate message + **Try again** button

**On retry:** Error entry removed from thread, original query resubmitted.

---

## Place Avatars

All place card thumbnails across the app use `PlaceAvatar` — a `boring-avatars` marble SVG generated deterministically from the place name. No real photos are loaded.

**Palette:** `#c8956c · #e8c99a · #7d9e7e · #4a7c59 · #d4a853` (Ghibli warm tones)

**Used in:** SaveSheet, RecallResultBubble, DiscoveryResults, RecallResults, ColdStartOneFour saved places list.

---

## Card Background Rule

All card surfaces use `bg-card` (pure white). The page background is warm cream (`bg-background`). Cards must contrast against it.

**`bg-card`:** SaveSheet cards, RecallResultBubble cards, DiscoveryResults cards, ConsultResult cards, AlternativeCards, SaveResultBubble, SavedSnackbar, modals, ColdStartZero step cards, suggestion buttons.

**`bg-muted`:** Thumbnail placeholders (when no avatar), skeleton loaders, toggle pills — never card containers.

---

## Save Action Reference

| Action | Thread bubble | Phase change | Use case |
|---|---|---|---|
| `autoSavePlace(place, sourceUrl)` | ✓ yes | ✓ → resting | High-confidence auto-save from SaveSheet |
| `saveIndividualFromSheet(place)` | ✗ no | ✗ no | Per-card save inside open SaveSheet |
| `closeSaveSheetWithResults(places)` | ✓ one per place | ✓ → resting | Sheet Done button |
| `saveQuiet(place)` | ✗ no | ✗ no | Discovery / starter pack inline save |

---

## Flow Registry

```
FLOW_BY_CLIENT_INTENT:
  consult      → consultFlow
  save         → saveFlow
  recall       → recallFlow
  assistant    → assistantStub

FLOW_BY_RESPONSE_TYPE:
  consult       → consultFlow
  extract-place → saveFlow
  recall        → recallFlow
  assistant     → assistantStub
  clarification → clarificationStub
  error         → (handled inline)
```

---

## Key Files

| Path | Purpose |
|---|---|
| `apps/web/src/store/home-store.ts` | State machine, all phases, thread, all actions |
| `apps/web/src/app/[locale]/(main)/home/page.tsx` | Page shell — empty-state routing, thread render, thinking indicator |
| `apps/web/src/flows/registry.ts` | Flow registry maps (by intent and by response type) |
| `apps/web/src/flows/flow-definition.ts` | `FlowDefinition` interface, `FlowId`, `HomePhase` types |
| `apps/web/src/flows/consult/` | ConsultThinking animation, ConsultResult card, schema, fixtures |
| `apps/web/src/flows/save/` | SaveSheet (with PlaceAvatar), SaveFlow, onResponse normalization, fixtures |
| `apps/web/src/flows/recall/` | RecallFlow (null render), onResponse normalization, fixtures |
| `apps/web/src/flows/discovery/` | DiscoveryResults — inline save via `saveQuiet`, PlaceAvatar |
| `apps/web/src/flows/cold-start-zero/` | ColdStartZero — 3-step onboarding, gold badges, quoted suggestions |
| `apps/web/src/flows/cold-start-1-4/` | ColdStartOneFour — chat bubble, saved list, nearby card, split pill |
| `apps/web/src/components/PlaceAvatar.tsx` | `boring-avatars` marble avatar, Ghibli palette, seeded by name |
| `apps/web/src/components/home/` | HomeIdle, TasteProfileCelebration, UserBubble, AssistantBubble, SaveResultBubble, RecallResultBubble, ConsultError, SaveError |
| `apps/web/src/app/layout.tsx` | Root layout — viewport meta, DM Serif Display + DM Sans fonts |
| `apps/web/src/app/globals.css` | CSS tokens, animations, Ghibli warm palette |
