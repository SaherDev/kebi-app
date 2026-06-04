# Kebi Design System

Strict guidelines for building Kebi. Follow these rules. Don't deviate.

If a screen needs something not in this doc, propose an ADR before building. Don't invent new tokens, components, or patterns inline.

---

## Source of Truth

The design system lives in three files:

- `kebi-tokens-mockup.html` — visual reference for every token and component
- `libs/shared` `category-emoji.ts` (`CATEGORY_EMOJI`, `CATEGORY_EMOJI_FALLBACK`, `SOURCE_LABEL`) — category → emoji avatar + source-label data mapping, typed against the `PlaceCategory` enum. `kebi-category-emoji.js` here is a visual-reference mirror.
- `design-system.md` — this document

If any of these conflict, the tokens HTML wins for visuals, this doc wins for behavior, the `libs/shared` consts win for data mapping.

---

## Tokens

### How to reference

Always use CSS custom properties. Never hardcode hex values in components.

```css
/* Correct */
background: var(--surface);
color: var(--text);

/* Wrong */
background: #F1F1EF;
color: #1A1A1A;
```

### Theme switching

Light/dark switches via a single class on `<body>`:

```js
document.body.classList.toggle('dark');
```

Never use separate stylesheets, separate component files, or `prefers-color-scheme` media queries inside components. The `.dark` class on body re-defines all tokens. Components stay theme-agnostic.

### Adding a new color

Don't. If you need a new color, write an ADR explaining why the existing tokens don't cover the case. The four semantic colors (success, like, warn, danger) cover every state in the app.

### Adding a new size

Don't. The spacing scale is fixed at 4, 8, 12, 14, 16, 24, 32. Pick the closest one. If your design needs an in-between, your design is wrong.

---

## Components

### Group container

Use for any list of 2 or more related items. Examples: place cards in library, settings rows, swap suggestions in chat, plan features.

**Required structure:**
- `background: var(--surface)`
- `border-radius: 14px`
- Rows separated by `1px solid var(--surface-2)` between siblings
- Section header above (uppercase eyebrow, 11px, 600, 0.08em letter-spacing)

**Don't:**
- Don't use a card for a single item. A single item is a row, not a card.
- Don't add shadows. Surface lift is the only depth signal.
- Don't add borders in dark mode. Surface-2 dividers are enough.
- Don't nest groups inside groups. Use surface-2 for the inner container.

### Status pills

Four variants only: green (saved/went), warm (new), amber (approve?), danger (closed).

**Required structure:**
- 11px font, weight 600, 0.005em letter-spacing
- 3px vertical / 10px horizontal padding
- 5px colored dot prefix
- Corresponding pill background tint

**Don't:**
- Don't invent new pill colors for new states. Map your state to one of the four.
- Don't use pills for non-state labels (use chips for that).
- Don't combine more than 2 pills on one card.

### Buttons

Three variants only: primary (filled dark), outlined (transparent + surface-2 border), danger (filled red).

**One primary button per screen.** Always. Never two. The primary CTA is the most important action on the screen.

**Required:**
- 13–14px font, weight 600
- 9–13px vertical / 14–16px horizontal padding
- `border-radius: 12px` (or `999px` for pill-shaped)

**Don't:**
- Don't use ghost buttons. Outlined or primary, no third option.
- Don't put two primary buttons in the same row.
- Don't use color for primary buttons (always var(--text) bg).
- Don't put icons inside primary buttons unless the action is destructive or directional.

### AI button

The 64px circular floating button at bottom-right of every screen.

**Always:**
- White fill in light mode (border-only)
- Cream-filled in dark mode (no border, brightest spot on screen)
- 16px from bottom edge, 16px from right edge
- Mascot SVG at 42px inside

**Only purpose:** open the chat / consult agent. Don't repurpose for other actions. Don't put it on the chat page itself.

### Toast

Black pill in light mode, cream pill in dark mode. Always opposite of page bg.

**Required:**
- Floats 92px from bottom (sits above the AI button)
- Auto-dismiss: 3s for confirmations, 5s for actions with undo/retry
- Max 280px wide
- Stacks vertically with 8px gap when multiple toasts fire
- Spring entrance: `cubic-bezier(0.34, 1.56, 0.64, 1)` over 280ms

**Use for:**
- Action confirmations ("saved", "copied", "approved")
- Undoable actions ("removed", "marked as been")
- Error recovery ("couldn't save that one — retry")

**Don't:**
- Don't use for modals or blocking content (use sheets).
- Don't use for navigation. Toasts confirm, they don't direct.
- Don't put more than one action button per toast.
- Don't show more than 3 toasts on screen at once.

### Chips

Two variants only: atmosphere (emoji-prefixed, surface fill) and feature (outlined, small icon).

- **Atmosphere** chips name vibes. `🕯️ intimate`, `💘 romantic`. Use on place pages.
- **Feature** chips name practical attributes. `private room`, `dog friendly`. Use on place pages.

**Don't mix the two styles in the same row.** They live in separate sections.

### Place avatar

Always emoji on a `var(--surface-2)` square, 28px in cards, 36px in row lists.

Default emoji comes from the primary category via `CATEGORY_EMOJI[place.categories[0]]` — `place.categories` is an array (`PlaceCore`), so use the first entry; fall back to `CATEGORY_EMOJI_FALLBACK` (📍) when it is empty or unmapped. User can override per-place when saving. Never use letter avatars (the "K" for Kamachiku style is deprecated).

### Reasoning block

Lives in chat above each Kebi answer that ran the agent. Inline editor content, no surface card.

**Required:**
- Header row: pulsing dot + "thinking" + meta (steps, time) + chevron
- Step list with vertical hairline rail
- Steps fade in on stagger (0ms, 350ms, 700ms, 1050ms, 1400ms)
- Active step has shimmer skeleton bars while content streams
- Collapsed by default after completion (auto-collapse on next user turn)

**Don't:**
- Don't show token costs or model names in user-facing copy.
- Don't show internal tag values like `cuisine=thai`. Use natural language.
- Don't put reasoning inside a card. It's editor content.

### Save sheet

Bottom sheet for capturing new places. Triggered from the bookmark icon in any top pill (home, library) and from the iOS share extension.

**Three states only:**
1. **Empty** — placeholder visible, save button disabled at 35% opacity
2. **Filled** — input has content, source detection meta row appears below input ("looks like a tiktok link"), save button active
3. **Saving** — input disabled, save button replaced with spinner + "saving" text, sheet auto-dismisses on success

**Required structure:**
- 24px rounded top corners only (bottom flush with screen edge)
- 36×4px drag handle centered at top
- Backdrop scrim with 2px blur, opacity 0.45 light / 0.55 dark
- Sheet slides up from bottom over 320ms with spring (`cubic-bezier(0.34, 1.4, 0.64, 1)`)
- Input is a textarea, not a single-line input — supports multi-line links and longer place names
- Hint text at bottom: "kebi figures out the rest. you can fix anything later."

**Don't:**
- Don't add a preview screen or confirmation step — save and forget is the whole point
- Don't let users edit extracted fields here — that happens in the library, not the sheet
- Don't dismiss on backdrop tap during the saving state — wait until the request resolves
- Don't trigger the AI button from inside the sheet — the AI button is hidden while sheet is open

### Long-press context menu

Wraps any card that has per-item actions. iOS "lift + blur" pattern (iMessage,
Notion, Apple Notes). Generic — any card supplies its own visual and action
list; place cards are the first consumer. Replaces the old swipe-to-delete row.
Visual source of truth: `kebi-context-menu-mockup.html`.

**Required structure:**
- Long-press (500ms hold) on a card; a short tap stays the card's normal tap
- At the moment the menu appears, the card lifts (scale 1.03 + lift shadow) above
  a frosted-blur, dimmed backdrop; the menu floats next to the lifted card
- Menu **always opens directly below** the card (10px gap). When the card sits too
  low for the menu to fit, the **card slides up** so the stack fits — the menu
  never flips. The slide **clamps at the top safe area**; if the menu is still
  taller than the screen, the **menu scrolls**
- Items: non-destructive first, a hairline divider before the first destructive
  item, destructive in `--danger` (place set: 👍 looks right · ❤️ i like this one ·
  ✅ been there · 🗑️ forget this place)
- Tap an item → runs its action, then closes; tap the backdrop → dismiss
- Only one menu open at a time
- Haptic `Impact.Medium` fires as the menu appears (see Haptics)

**Always pair destructive items with:**
- Toast confirmation: "{place name} removed" + Undo button (5s)
- Optimistic UI: row disappears immediately, backend confirms in background
- If backend fails, restore the row and show error toast: "couldn't remove that one"

**Overflow menu (`•••`) is the same menu list, different trigger:** tapped open
from a button, anchored under it — **no lift, no blur, no scrim**, tap-outside to
close. Use it where a card isn't long-pressed (e.g. the place page top pill).

**Don't:**
- Don't blur the backdrop for the overflow (`•••`) menu — blur is long-press only
- Don't omit the undo path — destructive actions always need recovery
- Don't put a long-press menu on the place page itself — that's the `•••` menu's job

### Overflow menu

Drop-down menu anchored under the ••• icon in any top pill. Used on the place page, may be added to others.

**Required structure:**
- Anchored 80px from top, 16px from right (under the more button)
- 14px corner radius, 6px internal padding
- Items at 10×12px padding, 8px row radius, transparent background by default
- Hover state: `var(--surface)` background
- Soft shadow: `0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)`
- Transparent backdrop catches taps outside to close
- Destructive items grouped at bottom, separated by 1px divider
- Destructive item color: `var(--danger)` for both text and icon

**Item order on the place page:**
1. share
2. add a note
3. mark as been
4. divider
5. remove from stash (destructive)

**Don't:**
- Don't put more than 6 items in a single menu — split into sections or nest
- Don't use destructive style for non-destructive items
- Don't omit the divider before destructive items — it's a visual safety check
- Don't auto-close before the user releases tap — wait for the action to resolve

---

## Voice & Copy

Lowercase everything except proper nouns and brand names. This is non-negotiable. Headers, buttons, labels, errors, sheets — all lowercase.

**Voice:**
- Casual, fragmented, conversational
- Read like a friend texting, not like a product
- Time-aware ("it's late, drunk food?", "good morning, breakfast?")
- Direct ("nuke my data", not "delete my data")

**Banned words and phrases:**
- "delete" → use "nuke" or "remove"
- "settings" → use eyebrow "settings" but hero "you" or "you, basically"
- "recommendations" → use "what kebi picked"
- "premium" → use the actual plan name (explorer, local legend)
- Em dashes "—" everywhere except in hero copy where rhythm needs them
- "Click here" → use the verb ("save it", "go legend")
- "Please" / "Thank you" — Kebi doesn't beg
- "Welcome back!" — Kebi doesn't fake enthusiasm

**Banned formatting:**
- No exclamation marks except in error toasts where urgency matters
- No emojis in body copy except where they're functional (status, vibes, avatars)
- No title case ("Save A Place")
- No semicolons (per user style)
- No asterisks for emphasis (use `<strong>`)

**Required formatting:**
- Use `·` (middle dot) for inline meta: `portuguese · ¥¥¥ · 8 min · shimokitazawa`
- Use real emoji for status, never image icons
- Use `@handle` for source attribution, never "saved from @handle"

---

## Layout

### Phone dimensions

Designed for 390 × 844 (iPhone 15-class). Don't redesign for other widths in v1. The Expo build will handle scaling.

### Safe areas

- Status bar: 50px top
- Home indicator: 34px bottom (always visible)
- Top bar: 12px top, 8px bottom, 16px horizontal

### Scroll area padding

Always 24px horizontal, 8px top, 24px bottom. Don't change per-screen.

### Top bar pattern

Every screen except the home page uses this pattern:
- Left: single icon-btn (back arrow or close ×)
- Right: top-pill containing 1–3 buttons (no separators between them)

**Standard pill contents per screen:**
- **Home** — bookmark (save) + book (library) + gear (settings)
- **Library** — search expand + bookmark (save)
- **Place** — edit + ••• (overflow menu with share, note, mark as been, remove)
- **Settings, Plans, Billing** — single icon variants per screen

The bookmark icon is the universal save trigger. Any screen that should support save adds it to the pill. Library is the exception with an expandable search input that grows from the right side of the pill toward center when tapped.

### Bottom dock

Single Kebi AI button at bottom-right. No tab bar. No nav. Don't add other buttons here.

The chat page is the exception — its bottom is a photo + mic toolbar pill (no AI button since you're already in chat).

---

## Behavior

### Animations

Every transition uses one of four timing functions:
- `ease-out` (200–280ms) — most state changes
- `ease-in-out` (240ms) — symmetric movements (open/close)
- `cubic-bezier(0.34, 1.56, 0.64, 1)` (280ms+) — entrances, springs
- `linear` (1.4s) — skeleton shimmer only

Don't invent new easing curves. Don't use 100ms (too fast). Don't use 500ms+ (too slow).

### Haptics

Haptic feedback makes Kebi feel alive. Use sparingly — every tap that vibrates dilutes the effect. The rule: **vibrate when something you did registered, never for incoming or passive events.**

iOS exposes three haptic families through `expo-haptics`:

- **Impact** — Soft, Light, Medium, Rigid. Physical-feeling interactions (button press, threshold crossed). **Never Heavy** — Heavy reads as an error and Kebi has no use for it.
- **Notification** — Success, Warning, Error. Outcomes (action confirmed, danger acknowledged).
- **Selection** — a single tick. Picker-like selections and reversible commits.

**Required haptic map.** Every haptic in the app comes from this table. Don't invent new ones — add a row here first.

| Trigger | Haptic | Why |
|---|---|---|
| Tap Kebi AI button (floating mascot) | `Impact.Soft` | Kebi waking up — warm, creature-like, not mechanical |
| "good pick" on chat place card | `Notification.Success` | Recommendation accepted, taste model updated |
| "save it" on chat place card | `Impact.Light` | Quiet acknowledgement, place tucked into stash |
| "not it" on chat place card | `Selection` | Reversible commit, no celebration needed |
| Save button in save sheet | `Notification.Success` | Place captured, sheet dismisses |
| Long-press a card → context menu lifts | `Impact.Medium` | Card picked up, menu surfaced — a deliberate lift, not a tap |
| Tap red action to confirm delete | `Notification.Warning` | Destructive action firing |
| Place actually removed after undo timer | none | Background, not user-triggered |
| "forget this place" in overflow menu | `Notification.Warning` | About to destroy data |
| Undo on a toast | `Impact.Light` | Recovery, quiet ack |
| Pull-to-refresh past threshold | `Impact.Light` | Threshold confirmation |
| Filter chip selected | `Selection` | Reversible choice |
| Theme toggle (light ↔ dark) | `Impact.Soft` | Mood shift, organic |
| Tab or top-pill icon tap | none | Navigation is silent |
| Toast appears | none | Visual is enough; you didn't trigger it directly |
| Streaming chat message starts | none | Passive incoming |
| Error toast appears | none | Visual is enough; the user didn't request the error |

**Don't:**
- Don't haptic on every tap. The Kebi button is the only tab-bar-level button that vibrates.
- Don't haptic on scroll, hover, or focus.
- Don't haptic on passive events (incoming toasts, streaming content, background syncs).
- Don't use `Impact.Heavy` anywhere.
- Don't stack haptics. If multiple events fire within 200ms, only the most important one fires.
- Don't haptic when the app is backgrounded or when reduced motion is enabled — respect the accessibility setting.

### Loading states

Three loading states. Pick the right one:

1. **Splash** (app boot only) — animated mascot + wordmark + tagline. ~2.5s. One screen, never reused.
2. **Loading screen** (auth resolving, blocking syncs) — mascot breathing + cycling status text + reassurance after 5s + cancel after 15s. Reusable.
3. **Skeleton** (mid-content) — shimmer bars matching the shape of the incoming content. Use inside place cards, chat reasoning steps, lists.

**Don't:**
- Don't show a spinner. Spinners are for windows 95.
- Don't block the UI for loads under 1 second. Show optimistic state instead.
- Don't show the splash on every screen. It's app-boot only.

### Optimistic UI

For user actions where the result is predictable (save, like, approve), apply the change immediately and fire the toast. If the backend fails, revert and show an error toast.

User actions that should be optimistic:
- Save a place
- Mark as been / liked / approved
- Theme switch
- Filter chip selection

User actions that should NOT be optimistic (require backend):
- Consult queries (always need real LLM call)
- Friend invites
- Subscription changes

### Error handling

Three error tiers:

1. **Recoverable** (network blip, validation) — toast with retry button, user stays on screen
2. **Blocking** (auth expired, account locked) — full-screen state with explanation + action
3. **Catastrophic** (app crashed) — fall back to splash, restart auth

Never show stack traces. Never show error codes unless the user asks. Always offer a next action.

---

## Data Model Bindings

### Place categories → avatars

Use `CATEGORY_EMOJI[place.categories[0]]` (the primary category). `PlaceCore.categories` is a `PlaceCategory[]`, so render the first entry; if it is empty or unmapped, use `CATEGORY_EMOJI_FALLBACK` (📍).

### Sources → labels

`PlaceCore` has **no** single `place.source` field — provenance is per-save, not per-place. Resolve the label from the save's source: `user_places.source_label` (surfaced when a user's saved places are read), or a `place_name_aliases[].source` value. Map that source identifier through `SOURCE_LABEL`. Six values: tiktok, instagram, youtube, google_maps_list, manual, kebi. Never display "saved from" prefix — the icon and handle are enough.

### Tags → UI sections

Each tag type has one and only one place it can render:

| Tag type | Where it renders |
|---|---|
| cuisine | meta line, eyebrow on place page |
| price | meta line as ¥/¥¥/¥¥¥ |
| time | home greeting (drives copy) |
| season | home greeting (drives copy) |
| atmosphere | atmosphere chips section on place page |
| feature | features chips section on place page |
| dietary | green pill below the title on place page |
| service | service-actions row on place page |
| accessibility | quiet last row on place page |

Don't render the same tag in two sections. Don't surface tags as code (`cuisine=thai`).

### Approved field

`approved == false` → amber "approve?" pill on the place card. Tap it to confirm and flip to `true`. Once approved, the pill disappears.

Don't show "vibe check" anywhere. That label is deprecated. Always use "approve?" for the unconfirmed state.

---

## Accessibility

- Min tap target: 44×44px (iOS standard)
- All icons have `aria-label`
- Color is never the only signal — pills have dots, status uses both color + label
- Text contrast: minimum 4.5:1 for body, 3:1 for large text
- Status bar text adapts to bg automatically (white on dark, black on light)

Don't ship a screen without testing accessibility tags. If a screen has icon-only buttons, every button has aria-label.

---

## Performance Budgets

- App boot to splash: under 1 second
- Splash to home: 2.5 seconds max (regardless of network)
- Place save extraction: 5–15 seconds (loading screen acceptable)
- Consult query: 5–10 seconds (chat reasoning streams progressively)
- Page transitions: 200–280ms

If a screen takes longer than its budget, show progressive content (skeleton, streaming) instead of a blocking spinner.

---

## What This Doc Doesn't Cover

- Per-screen layout specs (live with each mockup HTML)
- API contracts (live in `docs/api-contract.md` per repo)
- Backend architecture (live in `docs/architecture.md` per repo)
- ADRs (live in `docs/decisions.md` per repo)

If you're building a new screen, the order of operations is:
1. Read this doc (here)
2. Open the relevant mockup HTML
3. Read the matching ADRs
4. Build with tokens, never raw values
5. Match motion timing exactly
6. Run accessibility check before shipping

---

## Versioning

This doc is versioned with the app. v0.4.3 matches Kebi v0.4.3. Breaking changes to the design system require an ADR and a version bump. Patches (typo fixes, copy updates) don't.
