# Share and forget — a shared link feeds the taste model without the app ever opening

**Date:** 2026-08-19
**Status:** credential chain built and tested; extension, drain, and card outstanding
**Design:** `docs/kebi-app-design-system/kebi-while-you-were-away-mockup.html` (locked)
**Options explored:** `docs/kebi-app-design-system/kebi-share-forget-options.html`

## Goal

Kebi's product is the taste model, and the model is only as good as how much it is fed. Every
second between "I saw a place on TikTok" and "I'm back watching TikTok" is a tax on that input.

So: **sharing costs the user nothing, and the link reaches kebi whether or not the user ever
opens the app again.** The second clause is the hard part and the reason this plan exists — a
version where the link sits on the phone until the next launch captures a text file, not a taste.

## What exists today

A share cold-boots the whole app. `+native-intent.ts:13` rewrites the extension's
`mobile://dataUrl=…` to `/`, the root layout runs splash + fonts + theme + auth gate, home mounts
and fires three fetches, and only then does `ShareIntentReceiver` raise a prefilled save sheet.
The user came to dismiss all of it.

Three facts found while planning that shape everything below:

- **The App Group already exists.** `apps/mobile/ios/SavetoKebi/ShareExtension.entitlements`
  declares `group.app.kebi`, and `app.json` passes `iosAppGroupIdentifier` to the
  `expo-share-intent` plugin. Shared storage between app and extension is available today.
- **`pending` is already in the contract.** `apps/mobile/src/api/models/extract.ts` validates
  `status: z.enum(['pending', 'completed', 'failed'])` and `@kebi-app/shared` exports
  `ExtractStatus`. The client can already receive an async answer.
- **`apps/mobile/ios/` is not tracked** (`git ls-files` returns 0). It is prebuild output, so the
  Swift extension cannot be hand-edited — changes go through a config plugin or a
  `pnpm patchedDependencies` patch, as `patches/xcode@3.0.1.patch` already does.

Two constraints that rule options out:

- **The extension cannot hold the request.** `extract` is synchronous and takes ~30–60 s on a cold
  video URL (`api/extract.ts`, `EXTRACT_TIMEOUT_MS = 90_000`). iOS kills a share extension seconds
  after it completes.
- **Nobody is present when it lands.** Today's failure path is a toast
  (`save-sheet-context.tsx`) — in a forget-flow it fires while the user is still in TikTok.

## Approach

Three pieces, in dependency order.

### 1. Delivery that survives the extension being killed

The extension posts on a **background `URLSession`** — `.background(withIdentifier:)` with
`sharedContainerIdentifier = "group.app.kebi"`. iOS owns the upload once handed over and continues
it after the extension process is gone, relaunching the host app in the background on completion.

This is the piece that makes the goal true rather than aspirational: the request leaves the phone
at share time, not at next-open time. It also means **kebi's async `pending` mode is not a
prerequisite** — a synchronous 60 s extract is fine, because the system is holding the connection
and the server does its work regardless of whether anyone is listening to the answer.

### 2. A credential that works while the app is dormant

The extension needs to authenticate as the user, potentially days after the app was last opened.

**Not the Supabase session.** `lib/supabase.ts:27` persists it in AsyncStorage (app sandbox,
invisible to the extension), and moving it to the App Group is worse than it looks: the access
token expires in ~1 h, so the extension would have to refresh — and Supabase **rotates refresh
tokens**. An extension refresh invalidates the app's stored refresh token, silently signing the
user out. That is a data-loss bug hiding in an optimisation.

**Instead: a share token.** On sign-in the app asks the gateway to mint a long-lived, single-
purpose token (scope: enqueue one save for this user) and writes it into the App Group. The
extension sends it as a bearer. No Supabase refresh in the extension, no rotation race, and a
leaked token buys an attacker the ability to save places to someone's library — a real but bounded
blast radius, unlike a session token.

Stateless signed JWT rather than a `share_tokens` product table: no DB round-trip on a hot path,
no migration. Revocation is by expiry plus the app clearing the App Group on sign-out. **Open
question — see below.**

### 3. A fallback queue

Airplane mode, a rejected token, a background upload iOS gives up on. The link is written to a
queue file in the App Group and drained on next app open, via the existing `extract` path.

This is the whole of the cheaper architecture we considered, demoted to a safety net. It is where
the failures live, and it is why the UI has a working-row state at all.

### 4. The UI

`while you were away` — locked, spec in the mockup. Eyebrow always present and carrying the ✕;
14 px group container only at 2+ results; skeletons, never spinners; failed rows get a source
glyph, url-as-name, and plain danger text with no status pill.

Note it now serves a **narrower** purpose than when it was designed: in the happy path everything
already landed server-side, so it is a receipt. The draining/working state only appears for
fallback-queue items.

## Work, by repo

### `apps/mobile`

- App Group read/write module (Swift + JS bridge) — the extension and the app share a container;
  `expo-share-intent` already writes there for its own handoff.
- Extension rewrite: stop opening the host app, post on a background `URLSession`, fall back to
  the queue file on failure, `completeRequest` immediately. Delivered as a config plugin or patch
  since `ios/` is untracked.
- Remove the launch path — `+native-intent.ts` redirect and `ShareIntentReceiver` become dead for
  the share-extension case. **The in-app save sheet stays** for the home/library share icon.
- Share-token lifecycle: mint on sign-in, write to App Group, clear on sign-out.
- Queue drain on launch **and on foreground**, one code path.
- The `while you were away` component + its i18n strings (`src/i18n/en.json`).

### `services/api`

- Route accepting the share token and forwarding to kebi — the existing `ExtractController`
  requires a Supabase token via `AuthMiddleware`, so this is a second entry point to
  `ExtractService`, not a new pipeline.
- Share-token minting endpoint + verification.

### `kebi` (separate repo — `/Users/saher/dev/repos/kebi-dev/kebi`)

**Nothing required.** Async `pending` would let us drop the background-session machinery and is
the better long-term shape, but it is not on the critical path. Worth a handoff note (precedent:
`docs/library-areas-handoff.md`) rather than a blocking dependency.

## Open questions

1. ~~**Share-token revocation.**~~ **Resolved:** stateless, no table. Verification already reads
   user_settings to resolve the principal, so a table would not have saved the round-trip it was
   meant to justify. Sign-out drops the extension's only copy; the token itself lapses at 90 days.
   Revisit if a device is ever lost with a live token — that is the one case this does not cover.
2. **Drain concurrency.** Fallback items hit a 30–60 s path. Serial is slow with 5 queued; parallel
   risks `save_limit_reached` fan-out and rate limits.
3. **Killed mid-drain.** A queue entry must survive the app dying mid-extract without
   double-saving on the next drain — the queue needs an in-flight marker, not just delete-on-send.
4. **Placement.** Home only, or library too?
5. **Signed-out share.** Today the link is dropped (`share-intent-receiver.tsx:14` admits it). With
   a queue there is no auth at share time, so it can wait and drain after login — a real bug fixed
   for free. Confirm that is the intended behaviour.

## ADRs to write

- Share extension posts directly and never launches the app (supersedes ADR-048's "feeds the
  existing save flow").
- The share token: a second, narrow credential alongside the Supabase session, and why the session
  itself is not shared into the extension.
