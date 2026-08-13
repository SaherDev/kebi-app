# About-me profile + movement `source` — gateway half

**Date:** 2026-08-10\
**Scope:** `services/api` + `libs/shared` only. No mobile work in this pass.\
**Driven by:** kebi ADR-154 (`user_profile` on `/v1/chat`), ADR-155 (`movement_profile.source`), ADR-156 (unknown movement guesses wide). Canonical contract: `docs/api-contract.md` in the kebi repo.

## What the contract added

1. `POST /v1/chat` (+ `/stream`) takes an optional `user_profile`: `call_me` (≤40),
   `home_country` (ISO 3166-1 **alpha-2**, names/alpha-3 → 422), `about` (≤300 prose).
   All optional and nullable; whitespace-only reads as absent. kebi stores none of it.
2. `movement_profile.source` ∈ `user | default`, defaulting to `default`. kebi now
   **ignores `available_modes` on any block that isn't `source: "user"`** and substitutes
   its own wide fallback. Our config seed (`[walking, transit]`) was capping every user
   at walking range; marking seeded rows `"user"` would reinstate that bug exactly.

## Decisions taken

- **Transport: the token claim.** `about_me` is stamped into the sealed Supabase
  `app_metadata` alongside `plan`/`movement_profile` and read from the verified token on
  the chat path — no DB read per turn. Cost accepted: an edit reaches kebi only after the
  next token refresh, same as a plan switch.
- **The about-me is one field, stored whole**, `call_me` included, in
  `user_settings.about_me`. No second store and no Admin-API write to keep an account
  name aligned; an unset `call_me` falls back to the account display name at forward
  time, clamped to the contract's 40 chars.
- **Seeded rows stay `default`.** The config seed carries `source: default` explicitly and
  existing rows (no `source` key) forward as absent, which kebi reads as `default`. Only
  the movement setter writes `source: "user"`.

## Changes

**libs/shared**
- `MovementSource` + `MOVEMENT_SOURCES`; `MovementProfile.source?`; `DEFAULT_MOVEMENT_PROFILE`
  gains `source: 'default'`.
- `UserAboutMe` — the stored block (`call_me`/`home_country`/`about`, all nullable);
  `ChatUserProfile` is an alias of it, since the wire shape is the stored shape.
- `ChatRequestDto.user_profile`; `UserSettingsData.about_me`; `AuthUser.about_me`;
  `IdentityClaims.about_me`.
- `CALL_ME_MAX_LENGTH` / `ABOUT_ME_MAX_LENGTH` constants mirroring kebi's caps.

**services/api**
- Claim plumbing: `TokenClaims`, `AuthenticatedUser`, `StampClaims`, the Supabase metadata
  writer's seal + dedupe signature, and the Supabase identity provider's claim read.
- `ClaimStamper` — new class. The "build StampClaims from UserSettingsData and stamp" block
  exists in `AuthService.provision` and `UserService.changePlan` and would be copied into two
  more setters; it becomes one collaborator instead.
- `UserSettingsService`: `about_me: null` default, `source: default` on the seed,
  `updateAboutMe` and `updateMovementProfile` (the latter stamps `source: 'user'`).
- `PATCH /api/v1/user/about-me` and `PATCH /api/v1/user/movement` — validated setters that
  write settings then re-stamp. `home_country` is uppercased inbound and validated
  `@IsISO31661Alpha2`, so a country name is a 400 at our edge rather than a kebi 422;
  whitespace-only `about` stores `null`.
- `ChatUserProfileFactory` builds the wire block from the claim, falling back to the
  token's display name for `call_me`; `ChatService` forwards it. A user we know nothing
  about sends `user_profile: null`.
- Bruno requests for both setters.

## Mobile pass (option A)

Design options drawn and reviewed in `docs/kebi-app-design-system/kebi-settings-you-options.html`;
**A** chosen — two rows under a "what kebi knows" group, each pushing its own screen.

- `GET /user/settings` added: both blocks ride the token as a sealed claim the client cannot
  decode, so the edit screens had nowhere to read current values from — and a whole-block write
  from a blind form erases what was there.
- `about-you.tsx` (call_me / country picker / 300-char gist, one save) and
  `getting-around.tsx` (mode chips + reach, save is what earns `source: "user"`).
- `CountryPickerSheet` — our own sheet (absolute View, not a Modal, so toasts still layer
  above), search over `COUNTRIES` in `libs/shared`; names generated once from Node's
  `Intl.DisplayNames`, flags computed from the code.
- The profile pencil and `EditNameSheet` are **removed**: the name is `call_me` now, and the
  header renders `call_me ?? account name`. One name, one editor.
- Both saves toast and force `supabase.auth.refreshSession()`, or the next chat turn would go
  out with the old profile.

Two bugs found by running it, not by tests:
1. The dev-bypass path set `req.user` but never `req.identity`, so every settings write 500'd
   after succeeding (latent on `/user/profile` and `/user/plan` too). Fixed + regression test.
2. `GET /user/settings` passed `about_me` straight through, and a row predating the field has it
   `undefined` — JSON drops the key and the client's schema requires it. Now coerced to `null`.

## Result

Done and green: 578 tests across api / mobile / shared, lint clean (pre-existing warnings
only), `tsc` clean apart from pre-existing errors in `gallery.tsx`/`place-card.tsx` and two
entity `TS1272`s. The iOS bundle builds. ADR-054 recorded; Bruno requests for all three
endpoints. Verified live against a running gateway: lowercase `ae` stored as `AE`, a country
name rejected 400, `""` clearing to `null`, empty modes rejected, and a saved profile coming
back `source: "user"`.

## Acceptance

1. Never opened movement settings → forwarded block has `source: "default"` (seeded) or no
   `source` (pre-existing row).
2. Saved modes → `source: "user"` with the exact modes.
3. Cleared `about` round-trips as `null`, never as prose (DTO spec).
4. `home_country` reaching kebi is always alpha-2 (uppercased, validated at the edge).
