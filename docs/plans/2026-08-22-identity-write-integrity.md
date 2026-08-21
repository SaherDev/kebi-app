# Identity write integrity — corrupted internal_id repair and prevention

**Date:** 2026-08-22
**Status:** done — code merged to dev (PR #51 to main pending); production account
repaired and verified 2026-08-22; SHARE_TOKEN_SECRET rotated; DB_SYNCHRONIZE=false
set on Railway. Inventory found zero rows under the bad id (FKs rejected every
write), so the purge step was a no-op. Blob-era settings edits (curator grant,
newer about-me) were deliberately NOT restored — owner chose the pre-corruption
row as truth. Railway cannot alert on log content; a project webhook to
Slack/Discord (crashes + failed deploys) awaits the owner's webhook URL.

## Problem

A test internal id from a local `.env.local` (`user_3Ahq…`) is stamped on the
owner's real production Supabase account instead of the real internal id
(`user_s0cy69w2tuy0y88lnumlluq4`). Every request is served as a user that does
not exist, so the library reads empty while the data sits safely under the real
id. The dev-bypass hole that wrote it is already closed; the damage never healed
because:

1. **Settings writes copy the claimed id back.** `UserService.changePlan` /
   `updateAboutMe` / `updateMovementProfile` write the settings row and re-stamp
   `app_metadata` using `user.id` — the internal id read from the request
   token's claims. A token carrying a wrong id re-corrupts the account on every
   settings save.
2. **The stamp dedupe cache trusts its own last write.**
   `SupabaseMetadataWriter.lastStamped` skips the Admin API write when the
   claims match what it last wrote — not what is actually stored — so a
   correction can be silently dropped.
3. **Everything failed silently.** The exceptions filter translates kebi
   4xx/5xx without logging; login-time drift repair is invisible; stamp
   failures are per-class log lines with no stable, alertable shape.

Design intent (kept): identity is resolved from the `users` mapping at
login/signup only; the per-request path stays claim-first with no DB hit
(ADR-045). The clarified invariant this plan enforces: **reads may trust the
signed claims; anything that writes identity must source it from the mapping.**

## Part 1 — Code changes (branch `fix/identity-integrity` off `dev`)

### A. Identity may only be written from the mapping

- `UserIdentityService.lookup(authProvider, externalId)` — new lookup-only
  method (never creates), on top of the existing repository `findByExternal`.
- `ClaimStamper` becomes the choke point: inject `UserIdentityService` +
  `IDENTITY_PROVIDER`. Before stamping it looks up the mapping for
  `externalId`:
  - mapping exists and ≠ supplied `userId` → log `[IDENTITY_DRIFT]` error and
    **throw** — the stamp is refused, the settings write fails loudly.
  - mapping missing (local dev-bypass identity; no real account behind it) →
    warn and skip the stamp (the GoTrue write would 404 anyway).
- `UserService` settings setters derive the id they write with from the mapping
  (`lookup(provider.name, identity.externalId)`), falling back to `user.id`
  only when no mapping exists (dev bypass), with a warning. The resolved id is
  used for **both** the `user_settings` row write and the stamp, so a stale or
  corrupt token can no longer write another user's row.

### B. Remove the stamp dedupe cache

Delete `SupabaseMetadataWriter.lastStamped`. Stamps happen only at login (and
only when out of sync) and on settings writes — both rare; the cache's only
remaining effect is suppressing corrections. Stamp failures keep failing open
but log `[STAMP_FAILED]` at error level.

### C. Loud drift detection at login

`AuthService.provision`: when the token claims an `internal_id` different from
the resolved one, log `[IDENTITY_DRIFT]` (externalId, claimed id, resolved id)
before re-stamping. The repair itself already exists; it becomes visible and —
with B — guaranteed to actually write.

### D. Log kebi rejections in the exceptions filter

`AllExceptionsFilter` gains a `Logger`: kebi (Axios) errors log method, path,
authenticated user id, and upstream status at error level with a
`[KEBI_REJECT]` / `[KEBI_DOWN]` prefix. Non-Axios unhandled exceptions log with
stack. HttpExceptions (4xx business as usual) stay quiet.

Stable prefixes (`[IDENTITY_DRIFT]`, `[STAMP_FAILED]`, `[KEBI_REJECT]`,
`[KEBI_DOWN]`) are the contract for Railway log-based alerts (chosen alerting
channel).

### E. DB_SYNCHRONIZE can never be true in a deployment

Extract the runtime-marker check from `AuthMiddleware.isDeployed()` into
`services/api/src/common/deployment.ts` (`isDeployedEnvironment(config)`), use
it in both places: `resolveSynchronize` returns `false` (with a warning log)
whenever the process runs deployed, regardless of the env var. TypeORM
migrations proper are deferred to a follow-up task (ADR-035 trigger noted).

### F. Mobile route contract test

Every existing mobile route assertion derives its expected value from
`API_ROUTES` itself — a wrong route passes as a tautology (shipped:
`/user/library/areasss`, fixed in d7de966). Add
`apps/mobile/src/api/routes.spec.ts`: one `toEqual` literal snapshot of the
whole `API_ROUTES` object (paths transcribed from the gateway controllers, not
imported), plus literal cases for the four builder functions including
`encodeURIComponent` behaviour. Existing call-site specs stay as they are —
they test which key a function uses; the snapshot pins what the keys are.

### G. Tests

Update/add: `claim-stamper` (new verification behaviour), `auth.service`
(drift log + restamp), `user.service` (setters use mapped id), 
`supabase-metadata.writer` (cache removal — corrections always write),
`app.module`/`deployment` (synchronize refusal when deployed), filter logging.
Gates: `pnpm nx affected -t test,lint`.

## Part 2 — Production repair (after Part 1 deploys)

Order matters: deploy first, so nothing can write the bad id back mid-repair.

1. Railway: set `DB_SYNCHRONIZE=false` (safe immediately).
2. Deploy the gateway with Part 1.
3. Repair the account: one-off script (scratchpad, secrets from Railway env) —
   find `externalId` for `user_s0cy69w2tuy0y88lnumlluq4` in `users`, read its
   `user_settings`, seal correct claims with `AppMetadataCipher` semantics,
   `PUT /auth/v1/admin/users/{externalId}`, then GET + decrypt to verify.
4. Rotate `SHARE_TOKEN_SECRET` on Railway — invalidates the share extension's
   90-day credential minted for the bad id (source of the FK log flood). The
   app re-mints on next launch.
5. Inventory rows under `user_3Ahq…` (gateway `users`/`user_settings`, kebi's
   AI tables via SQL), present the list, then purge after explicit confirmation
   (user chose purge-everywhere).
6. Verify end-to-end: owner signs in on device; library shows the 50 places;
   Railway logs clean of FK errors and `[IDENTITY_DRIFT]`.

## Out of scope

- TypeORM migrations adoption (follow-up; ADR-035's "production data accrued"
  trigger has fired).
- kebi-repo code changes (its FK errors were the symptom, not the fault).
