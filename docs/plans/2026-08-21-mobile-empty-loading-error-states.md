# Mobile empty / loading / error states

**Date:** 2026-08-21
**ADR:** ADR-056 — a screen is always in one of four states, and no two of them look alike
**Design system:** `design-system.md` § the four states of a screen · § loading states · § empty states · § error handling
**Kernel mockup:** `docs/kebi-app-design-system/kebi-states-kernel-options.html`

---

## Goal

Give every surface in `apps/mobile` an answer to all four states — **loading, empty, failed,
unbuilt** — so that none of them is a blank region, and no two of them look alike.

Today: 8 screens show a banned centred spinner, 0 screens have a skeleton, 2 have an empty state,
1 has a first-load error. Three of the gaps are bugs, not polish:

| Bug | Where | Effect |
|---|---|---|
| A failed read is saved back as empty | `about-you`, `getting-around` | one tap overwrites a real profile with blanks, and chat quietly degrades from then on |
| A failed read renders as a value | `settings` | tells users their answers are "not set" when they aren't |
| A failed section renders as nothing | `home`, `area` | 40 saves look identical to 0 saves, with nothing to retry |

**Definition of done for any screen:** all four states answered, light + dark, matching its
`kebi-<page>-states-options.html`.

---

## The kernel (locked)

| State | Treatment |
|---|---|
| **loading** | skeleton in the content's exact geometry, sweep shimmer `1.4s linear`. Only what the server owes, only what is guaranteed to arrive, never what we already hold. Static text never shimmers. |
| **empty (cold)** | ghost preview — faded real rows — with the action as the **last row** (`+`, dashed avatar). No filled primary button, no mascot. |
| **empty (filtered)** | echo the query + `clear search`. No ghost, no `+` row. |
| **failed (first load)** | the skeleton freezes (shimmer off, 45%) under a one-line error row: dot · sentence · action. |
| **failed (content present)** | toast + retry, 5s. Content is never replaced. |
| **failed (404 / gone)** | explanation + a way out, **no retry**. |
| **offline / 429** | `--warn`, not `--danger`. Not an error. |
| **unbuilt** | name what will live here, point at the screen that works. |

Also locked: `--danger` is a dot colour, not body text · the mascot keeps only splash + blocking
load · a spinner inside a button is fine (an action in flight, not content on its way).

---

## Pages

### A. Designed — mockups exist, options chosen, ready to build

| # | Screen | File | Route / component | Decided |
|---|---|---|---|---|
| 1 | home | `kebi-home-states-options.html` | `app/index.tsx` | shimmer only greeting + chips + location line; one ghost stash group on day one; each section owns its failure; offline shows in the location line |
| 2 | library | `kebi-library-states-options.html` | `app/library.tsx` | hero + 1 area header + 3 cards shimmer; search = 2 skeleton cards under a shimmering count; ghost cards + `+` row replace the mascot empty (keep the bookmark ring); frozen skeleton on failure; **new**: a failed paged tail is currently silent |
| 3 | area | `kebi-area-states-options.html` | `app/area.tsx` | title real from frame one (the link carries it); "nothing of yours here" as a quiet line in the section's own slot; dead link gets its own screen with no retry; late summary is not an error |
| 4 | place | `kebi-place-states-options.html` | `app/place.tsx` | seeded open paints what the card knew, cold open is a full skeleton; bare-place line stays; empty tag sections disappear; four failures, four answers |
| 5 | my notes | `kebi-notes-states-options.html` | `app/my-notes.tsx` | hero never waits; capability wait looks like the data wait minus the write button; ghost note + `✎` row; error adds "they're still there — this is the list, not the writing" |
| 6 | shares | `kebi-shares-states-options.html` | `app/shares.tsx` | ghost share + one-line instruction (no `+` row — sharing happens in another app); row states unchanged; **no** screen-level loading state (data is local) |
| 7 | chat | `kebi-chat-states-options.html` | `components/chat-screen.tsx` | kebi speaks first on an empty transcript; failed turn gets an error row + "ask again" that resends; 429 is warn-toned, retry-less, may name a plan; `--danger` stops being body text |
| 8 | settings | `kebi-settings-states-options.html` | `app/settings.tsx` | static furniture never shimmers; failed summary shows `—` + a persistent warn line, never "not set" |
| 9 | about you · getting around | `kebi-forms-states-options.html` | `app/about-you.tsx`, `app/getting-around.tsx` | copy stays, fields shimmer; **failed read = frozen fields, no inputs, no save button**; button becomes spinner + "saving" |
| 10 | plans · billing | `kebi-plans-states-options.html` | `app/plans.tsx`, `app/billing.tsx` | only the CTAs shimmer (everything else is a local constant); profile failure = read yes / write no; billing names what will live there and drops the empty ••• |

### B. Still to design — screens

| # | Screen | Route | What its file has to decide |
|---|---|---|---|
| 11 | help | `app/help.tsx` | the feedback sheet's sending / sent / failed states; whether a failed submit keeps the typed report (it must) |
| 12 | login | `app/(auth)/login.tsx` | phone/email validation, "sending code" in-flight, provider-unavailable, offline before auth exists |
| 13 | verify | `app/(auth)/verify.tsx` | wrong code · expired code · rate limited — three different sentences today collapsed; resend cooldown |
| 14 | splash / auth gate | `app/_layout.tsx`, `components/splash.tsx` | what a slow or failed session restore shows after the splash budget (2.5s) expires — the app's only true blocking wait |

### C. Still to design — overlays and sheets

Not routes, but each is a surface a user waits on, and none has a failure state today.

| # | Surface | Component | Why it needs one |
|---|---|---|---|
| 15 | save sheet | `save-sheet.tsx` | has empty/filled/saving already; needs **failed** (and it's the app's main write path) |
| 16 | curate sheet | `curate-sheet.tsx` | insider write with no receipt — a failed submit must keep the prose |
| 17 | note sheet | `note-sheet.tsx` | same: a note that fails to save must not vanish |
| 18 | report sheets | `report-save-sheet.tsx`, `report-wrong-answer-sheet.tsx` | sending / sent / failed |
| 19 | feedback form sheet | `feedback-form-sheet.tsx` | shared with help (#11) — decide once, there |
| 20 | country picker | `country-picker-sheet.tsx` | a long list with a filter: filtered-empty case |
| 21 | maps chooser | `maps-chooser-sheet.tsx` | "no maps app installed" is an empty state nobody wrote |
| 22 | confirm sheet | `confirm-sheet.tsx` | the confirmed action's in-flight and failed states (nuke, clear history) |
| 23 | action sheet / context menu | `action-sheet.tsx`, `context-menu/` | an item whose action fails — undo path exists, failure path doesn't |
| 24 | while you were away | `while-you-were-away.tsx` | home card; row states exist, card-level failure doesn't |
| 25 | share intent receiver | `share-intent-receiver.tsx` | the moment a share lands while the app is cold |
| 26 | toasts | `toast.tsx` | already the settled vocabulary — audit only, that every new error routes through it |
| — | gallery | `app/gallery.tsx` | dev route. Add a Section per new state component, per the existing convention. |

---

## Build order

1. **The three bugs first** — #9 forms (data loss), #8 settings (false claim), #1 home + #3 area
   (silent section failure). These ship value independent of the visual pass.
2. **Shared primitives** — one `Skeleton`, one `ErrorRow`, one `GhostPreview` + `AddRow`, in
   `apps/mobile/src/components`, added to `/gallery` in light + dark. Everything after this is
   composition.
3. **The list screens** — #2 library, #4 place, #5 notes, #6 shares.
4. **The rest** — #7 chat, #10 plans/billing.
5. **Design then build B and C** — #11–#26, same file convention: `kebi-<page>-states-options.html`
   + light/dark PNGs, options → chosen → built.

Each step: `pnpm nx affected -t test,lint`, and type-check via
`tsc --noEmit -p apps/mobile/tsconfig.app.json` (the `typecheck` target is stale).

---

## Out of scope

- `apps/web` — parked (ADR-040).
- Copy translation beyond `apps/mobile/src/i18n/en.json`; English is the only locale.
- Any new colour, size or motion curve. Everything above uses existing tokens.
