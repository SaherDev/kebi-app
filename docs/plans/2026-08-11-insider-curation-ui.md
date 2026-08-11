# Insider curation — UI build plan

**Date:** 2026-08-11
**Design:** `docs/kebi-app-design-system/kebi-curate-options.html` (five sections, all settled)
**Foundation:** merged to `dev` — gateway routes, curator guard, capability layer. No UI built.

Each task below is independently scopeable: it names a **goal line** to paste into
`/goal`, what is in scope, and what "done" means. They are ordered by dependency,
not by size. Task 1 is the only one that proves the pipeline works end to end;
tasks 3 and 4 are cheap once it exists.

---

## What we are building

An insider can add what they know **from wherever they already are** — three taps
and some typing — and everything they wrote is visible and removable in one place.
Every affordance hangs off the capability gate, so one admin boolean turns the
whole feature off.

Five checks for the feature as a whole:

1. From a **place**, an **area**, a **chat entity**, or **settings**, the composer
   opens with the right anchor already filled
2. Write prose → send → sheet closes → toast → the claims exist (visible in that
   place's insider notes)
3. The anchor is **changeable in place**, and writing **unanchored** is allowed
4. **"What you've added"** lists everything grouped by place/area; long-press
   removes one, with undo
5. A non-insider sees **none** of it, and flipping `can_curate` off removes all of
   it at once

---

## What already exists (do not rebuild)

| Piece | Where |
| --- | --- |
| `POST /knowledge/curate` (anchored), `GET /claims`, `DELETE /claims/:id`, `GET /entities` | gateway, all behind `CuratorGuard` |
| `useCan('curate')` · `<Can do="curate">` · `useRequireCapability('curate')` | `apps/mobile/src/capabilities/` |
| Global sheet pattern — provider mounts once, any surface calls `open(...)` | `note-sheet-context.tsx` (mirror it) |
| Long-press lift + frosted blur + menu below | generic `ContextMenu` + `usePlaceMenuItems` as the builder pattern |
| Quote-rail rendering of claims | `place-claims-section.tsx` |
| Green status pill, `Group`, `SettingsRow` | `status-pill.tsx`, `group.tsx`, `settings-row.tsx` |

---

## Task 0 — grant yourself the role

**Goal line:** `A curator grant exists that I can apply to my own account, so insider UI is testable on a device.`

Blocks verifying every task below: `UserSettingsService.updateCanCurate` exists but
nothing exposes it, so today the only way to become an insider is a manual DB write.
ADR-112 deliberately punts the admin surface, so the cheap answer is a one-off
script or a documented SQL snippet — **not** a self-serve endpoint.

**Done when:** a named account can be flipped to `can_curate: true` and back, and
the flip is visible to the app after a token refresh.

---

## Task 1 — the composer, and one door

**Goal line:** `The curate composer sheet exists and opens from the place ••• sheet with that place anchored; writing prose and sending it creates claims on that place.`

The hub. Every other door is a different way of calling the same `open(anchor)`.

**In scope**
- `CurateSheetProvider` mounted once (mirror `NoteSheetProvider`), raised via
  `useCurateSheet().open(anchor)`
- Sheet: opens **tall** with the keyboard, anchor chip on top (read-only for now),
  hero "what do you know?", prose field, hint carrying **"everyone sees them"**
- Two states only: empty (button 35%) and filled. **No "adding" state**
- Submit **closes immediately**, plain 3s toast naming the count from
  `claims_written` (the response is synchronous)
- Swipe-down **keeps a draft per anchor**, restored on reopen, cleared on submit
- One door: a new group in the place `•••` sheet, gated by `<Can do="curate">`,
  reading **"add what you know" / "everyone will see it"**, sitting between the
  personal actions and "forget"

**Out of scope:** anchor search, other doors, the ledger, delete.

**Done when:** as an insider, `•••` → add what you know → type → send → toast →
the note appears in that place's insider notes. As a non-insider the row is absent.

---

## Task 2 — the anchor chip

**Goal line:** `The anchor chip expands in place into a place/area search, so the composer's subject can be changed or chosen without leaving the sheet.`

**In scope**
- Chip → search field **in place** (the library top-pill expand is the precedent),
  results drop beneath it, prose stays visible underneath, `×` restores the
  previous anchor
- One mixed result list from `GET /knowledge/entities` — areas lead, then places,
  told apart by avatar + sub-label. **No type toggle**
- The id field **is** the anchor payload: `place_id` straight through, `area_id`
  from the token — they are not interchangeable
- Unanchored is legal: submit stays live with an empty chip

**Done when:** the anchor can be changed mid-write without losing the prose or the
keyboard, and an unanchored note still sends.

---

## Task 3 — the remaining doors

**Goal line:** `The curate composer opens from an area, from a chat entity chip, and from settings, and settings shows the insider pill.`

Three cheap doors once Task 1 exists. Each is a different `open(anchor)`.

**In scope**
- **Area:** the area screen has **no `•••` today** (`TopBar left={back}` only), so
  this adds a top-pill and its action sheet. The `•••` itself renders **only for
  insiders** — an area has no other actions, so it would otherwise open empty
- **Chat:** long-press the **rail chip** (not the inline link — it fights the iOS
  selection loupe), same lift + blur + menu as the library cards. The entity
  arrives resolved from the turn's `entities`, so no lookup is needed.
  **Menu settled as the minimal shape:** `open` · `add what you know`. The place
  actions all need a *saved* place (which a chat entity usually isn't) and none
  of them mean anything for an area, so they'd be conditional rows on a chip a
  third the width of a library card. "add what you know" is the only item correct
  in every state — saved venue, unsaved venue, area — since curating needs no
  save and no ownership. Growing it later is additive.
- **Settings:** a `knowledge` group **below "what kebi knows"** with the
  "add what you know" row, plus the green **insider** pill under the name

**Done when:** all four doors open the same sheet with the right anchor, and none
of them render for a non-insider.

---

## Task 4 — what you've added

**Goal line:** `The "what you've added" screen lists my claims grouped by place or area, and long-pressing one removes it with an undo toast.`

The only place an insider can ever see what their prose became — there is no
receipt anywhere in the flow, which is what makes this screen load-bearing.

**In scope**
- Screen behind a second settings row, route-gated with `useRequireCapability`
- `GET /knowledge/claims`, **grouped by anchor** client-side (one paragraph becomes
  several claims, so a chronological list would scatter one sitting)
- Same quote-rail vocabulary as the place page — your notes look here exactly as
  strangers see them. No counts, no status, no metadata
- Long-press a note → one destructive item → `DELETE /knowledge/claims/:id`,
  optimistic removal, toast **"note removed" + undo, 5s**, restore + error toast on
  failure. No confirm dialog — the undo *is* the confirmation
- `✎` in the top pill opens the composer unanchored

**Done when:** every note I wrote is listed under its place or area, and removing
one is reversible within the toast window.

---

## Deliberately not built

- **No undo on the write** — open, write, send. The write itself is not reversible
  from the toast (only a *deleted note* is, in Task 4)
- **No receipt / review screen** after submitting
- **No approval gate** — the guard is who may write at all (ADR-112), not a step
  in the flow
- **No drift nudge** on the anchor — it was the one piece needing new intelligence
- **No self-serve "apply to be an insider"** — ADR-112 punts it

---

## Open questions

1. **Chat menu contents** (Task 3) — three rows always, or mirror the full
   place-card menu when the entity is a saved place? Affects nothing else
2. **`revalidate` triggers** — wired but never called. App-foreground and
   pull-to-refresh are the natural hooks, if a grant should land sooner than the
   next profile read
3. **Revocation latency** — the guard reads a token claim, so a revoked insider
   keeps working until refresh. Server-side, out of scope for this UI, but it is
   the gap between "one boolean stops everything" and *when*
