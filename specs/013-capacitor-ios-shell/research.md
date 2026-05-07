# Phase 0 Research — Capacitor iOS Shell for Kebi Web

**Feature**: 013-capacitor-ios-shell
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)

This document resolves every `NEEDS CLARIFICATION` in the plan's Technical Context and records the alternatives considered for each decision. All findings are written for future-me re-opening this feature in six months.

---

## Decision 1 — Architecture: C2 (remote-URL shell with runtime-native API branch)

**Decision**: Capacitor's `server.url` points the iOS WKWebView at the live Vercel deployment (`https://kebi-app-ten-phi.vercel.app`). The same JS code that ships to browser users also runs inside the WebView. A single `Capacitor.isNativePlatform()` check in the chat client's `FetchClient` instantiation switches outbound `/api/v1/*` requests from relative paths (hitting the Vercel rewrite proxy) to absolute URLs pointing directly at the Railway NestJS backend.

**Rationale**:

- Preserves the web build byte-for-byte. No edits to `middleware.ts`, `next.config.js`, or any route file (satisfies User Story 4 and SC-006 literally).
- No static export, which means none of the hard Next.js incompatibilities kick in:
  - `middleware.ts` + `output: 'export'` would error at build time; here, middleware still runs on Vercel for both web and iOS traffic.
  - `rewrites()` + `output: 'export'` would be silently dropped; here, the rewrite still handles browser traffic, and the iOS-mode client bypasses it via absolute URLs.
  - Dynamic `[locale]` segments would require `generateStaticParams`; here, Next.js continues to SSR them.
  - Server `redirect()` in `[locale]/page.tsx` would need client replacement; here, it still works under Vercel SSR.
- Total hand-written diff: ~32 lines. C3 (static export) would have been ~200+ lines across 8+ files plus a build-staging shell script.
- Matches FR-002 (API traffic directly to Railway, no intermediate proxy). Vercel is still in the path for HTML/JS/CSS delivery per FR-002b, but not for API calls.
- Matches the user's earlier CORS hint: the WebView's document origin equals the Vercel domain, so `APP_CORS_ORIGINS` only needs the one Vercel entry (and any existing dev entries) — not a separate `capacitor://localhost` entry.

**Alternatives considered**:

- **C1 — Pure remote URL, no API client change.** `server.url = https://kebi-app-ten-phi.vercel.app`, and the iOS app makes same-origin `/api/v1/*` calls that flow through the Vercel rewrite to Railway. Simplest possible (zero code changes), but violates FR-002 because Vercel becomes the API proxy, and it hard-couples the iOS app's API availability to Vercel's uptime. Rejected.
- **C3 — Static export with dual build.** Add `output: 'export'` under `BUILD_TARGET=ios`, stage `middleware.ts` aside during the iOS build via a shell script, add `generateStaticParams` to `[locale]/layout.tsx`, replace the root `redirect()` with a client component, introduce an `IOSAuthGate` to replace middleware-based auth gating, and produce `out/` for Capacitor to consume. Roughly 10× the hand-written diff, touches auth UX, risks web regressions every time someone edits the staging script. Rejected.
- **Option A from the stale plan** (a hybrid of C3): same as C3 but with more ceremony. Rejected.
- **Using `@ionic/react-router` or rewriting UI natively**: grossly over-scoped. Rejected without investigation.

---

## Decision 2 — Capacitor version

**Decision**: Capacitor 6.x (latest stable). Install `@capacitor/core@^6`, `@capacitor/cli@^6`, `@capacitor/ios@^6`, `@capacitor/geolocation@^6`.

**Rationale**:

- Capacitor 6 is the current stable major at the time of this feature.
- Supports iOS 13+ minimum, which covers the owner's personal iPhone trivially.
- Works with Node 20, pnpm workspaces, and TypeScript 5.x — all the existing `apps/web` constraints.
- Geolocation plugin version must match the core major version per Capacitor's versioning policy.

**Alternatives considered**:

- **Capacitor 7 beta**: newer but not stable. No reason to take beta risk for a personal dev build. Rejected.
- **Capacitor 5**: older, still functional, but receives only security fixes now. No reason to pick it over 6. Rejected.
- **Pinning to exact versions** (`@capacitor/core@6.1.2`): possible but `^6` is fine for this feature; the next upgrade will be a separate /speckit.specify when it happens. Deferred.

---

## Decision 3 — `server.url` vs `webDir`

**Decision**: Use `server.url = 'https://kebi-app-ten-phi.vercel.app'` as the primary load target. Set `webDir = 'public'` as a stub that points at `apps/web/public/`, which already exists and holds static assets like `favicon.svg`. This satisfies Capacitor's config validation (which requires `webDir`) without adding a new directory or producing a static export.

**Rationale**:

- Capacitor's config schema requires `webDir` even when `server.url` is set, because `cap sync` needs somewhere to copy the app bundle into the native project when the iOS app is launched offline. Pointing `webDir` at `apps/web/public/` gives `cap sync` a real directory that already contains valid files (favicon, icons, etc.) without generating anything new.
- When `server.url` is set and reachable, Capacitor loads from that URL at runtime and ignores the bundled `webDir` contents.
- Using the existing `public/` dir avoids creating an `out/` directory or any build-time artifact for iOS.

**Alternatives considered**:

- **Create an empty `apps/web/capacitor-stub/` directory with a placeholder `index.html`**: works but adds a new dir to maintain and commit. Rejected.
- **Build a minimal static page with "offline — network required" messaging and use that as `webDir`**: over-scoped for a personal dev build. Deferred to a future offline-mode feature.
- **Omit `webDir` entirely**: Capacitor errors out. Not possible.

---

## Decision 4 — Runtime API base URL derivation

**Decision**: In `apps/web/src/lib/chat-client.ts`, derive the iOS-mode base URL at runtime from `process.env.NEXT_PUBLIC_API_URL` with the trailing `/api/v1` stripped via a regex. Pattern:

```ts
import { Capacitor } from '@capacitor/core';

function makeRealChatClient(getToken: () => Promise<string>): ChatClient {
  const apiBase = Capacitor.isNativePlatform()
    ? (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/api\/v1\/?$/, '')
    : '';
  const http = new FetchClient(apiBase, getToken);
  // … rest unchanged
}
```

**Rationale**:

- `NEXT_PUBLIC_API_URL` is already required in `deployment.md` line 86 and is already referenced by `apps/web/src/api/client.ts:10` with a non-null assertion. It is therefore already set on Vercel for the production deployment, otherwise the existing build would fail at runtime. No new env var plumbing needed.
- The existing env value includes the `/api/v1` suffix (e.g. `https://api-kebi-app.up.railway.app/api/v1`) because `next.config.js` rewrites append the path suffix directly.
- `chat-client.ts` calls `http.post<>('/api/v1/chat', ...)` with the `/api/v1` prefix in the path, which collides with the env value's suffix. The regex strip keeps the env var unchanged (preserving web build behavior) while producing a clean base URL for the iOS mode: `https://api-kebi-app.up.railway.app`.
- The whole derivation is a single expression, no helper function, no new exported constant. It stays inside `makeRealChatClient` where it's used.
- Browser behavior is preserved: `Capacitor.isNativePlatform()` returns `false` in a regular browser, so `apiBase` stays `''` and the existing relative-path flow continues.

**Alternatives considered**:

- **Add a new env var** `NEXT_PUBLIC_RAILWAY_BASE_URL` that is bare (no `/api/v1` suffix). Cleaner conceptually but requires setting a second Vercel variable, documenting it in `kebi-config/deployment.md`, and remembering to set it in every environment. Over-engineered for a one-liner. Rejected.
- **Refactor `FetchClient` to accept a base URL with `/api/v1` built in**: touches shared transport code that is used by both web and iOS, with risk of breaking web. Rejected.
- **Move the `/api/v1` prefix out of `chat-client.ts`'s hard-coded path into a shared constant in `libs/shared`**: good long-term hygiene per ADR-010, but out of scope for this feature. Deferred.
- **Read the config from Capacitor's native side via a bridge call**: massive over-engineering. Rejected.

---

## Decision 5 — `allowNavigation` list

**Decision**: `capacitor.config.ts` sets `server.allowNavigation` to a wildcard-friendly list covering the expected OAuth chain for Clerk + Google:

```ts
server: {
  url: 'https://kebi-app-ten-phi.vercel.app',
  cleartext: false,
  allowNavigation: [
    'kebi-app-ten-phi.vercel.app',
    '*.clerk.accounts.dev',    // Clerk dev frontend API
    '*.clerk.com',             // Clerk prod frontend API (if/when migrated)
    'accounts.google.com',     // Google OAuth consent
    'oauth2.googleapis.com',   // Google token exchange
    'ssl.gstatic.com',         // Google OAuth asset host
  ],
}
```

**Rationale**:

- Clerk's `authenticateWithRedirect({ strategy: 'oauth_google' })` chains through Clerk's frontend API → Google's consent page → back to Clerk → back to the app's sso-callback URL. Every hop must be in `allowNavigation` or WKWebView blocks it.
- The exact Clerk frontend API host depends on whether the owner's Clerk instance is in dev mode (`<slug>.clerk.accounts.dev`) or prod mode (`clerk.<your-domain>`). The wildcard `*.clerk.accounts.dev` + `*.clerk.com` covers both cases without requiring the plan to know the current state.
- `accounts.google.com` and `oauth2.googleapis.com` are Google's OAuth2 endpoints. `ssl.gstatic.com` is a commonly required asset host for Google login UI.
- Anything NOT in the list gets opened in `SFSafariViewController` (Capacitor's default fallback) instead of the WebView, which would break the sign-in return flow. Being too permissive here is safer than being too restrictive for a personal dev build.

**Alternatives considered**:

- **Use `allowNavigation: ['*']`**: maximally permissive, works immediately, but Capacitor docs actively warn against it because any compromised script could load attacker content into the main WebView. Rejected — even for a dev build, hygiene matters.
- **Hardcode the exact current Clerk frontend API host** (e.g. `active-seagull-99.clerk.accounts.dev`): brittle; the host changes if the owner migrates to a prod Clerk instance. Rejected.
- **Derive the Clerk host from the publishable key at build time**: the publishable key encodes the frontend API as a base64 suffix. Tooling exists but is over-scoped for this feature. Deferred.

---

## Decision 6 — Apple sign-in handling

**Decision**: Wrap the existing Apple button in `login/page.tsx` with `{!isNativePlatform && (<AppleButton />)}`. The Google button stays visible in both web and iOS modes. No other changes to the sign-in flow.

**Rationale**:

- Resolved by Q3 in `/speckit.clarify`. Apple's OAuth page (`appleid.apple.com`) explicitly blocks WKWebView user agents with an "unsafe browser" error. No `allowNavigation` setting can bypass this.
- Hiding is a one-line runtime check; web UX stays exactly as it is today.
- Native Sign in with Apple via `@capacitor-community/apple-sign-in` is deferred to a follow-up feature per the spec's Out of Scope section.

**Alternatives considered**:

- **Ship with the Apple button visible and let the user hit the error**: intentional half-broken UX. Rejected in the clarify pass.
- **Swap to native Sign in with Apple now**: requires Clerk custom-token config + Apple Developer capability setup. ~100+ lines and external account configuration. Rejected — deferred.
- **Drop both buttons and add email code sign-in**: out of proportion to this feature. Rejected.

---

## Decision 7 — Geolocation plugin

**Decision**: Install `@capacitor/geolocation`. Make zero JS changes to the existing `navigator.geolocation` call. The plugin's only job in this feature is to inject `NSLocationWhenInUseUsageDescription` into `Info.plist` during `cap sync`.

**Rationale**:

- Resolved by the geolocation clarification bullet. Without the `Info.plist` key, WKWebView's `navigator.geolocation` fails silently on iOS with no permission prompt.
- The plugin auto-manages the Info.plist key — preferable to hand-editing the plist file, which would drift between `cap sync` runs.
- Migrating the JS to `Geolocation.getCurrentPosition()` from the plugin is better long-term for cross-platform consistency, but unnecessary for this feature and increases scope.

**Alternatives considered**:

- **Hand-edit `Info.plist` directly** without installing the plugin: works but the edit would have to be reapplied every time someone runs `npx cap sync` or regenerates the iOS project. Rejected.
- **Migrate JS to the plugin API now**: out of scope. Deferred.

---

## Decision 8 — Committing the generated `ios/` directory

**Decision**: Commit `apps/web/ios/` in full, minus `ios/App/Pods/`, `ios/DerivedData/`, and `ios/App/App/public/`. Add these three paths to `apps/web/.gitignore`.

**Rationale**:

- Commits are reproducible: `npx cap open ios` works immediately after a fresh clone.
- `Pods/` is rebuilt by `pod install` from `Podfile.lock`, which is committed — no reason to track the contents.
- `DerivedData/` is Xcode's build cache. Never commit.
- `ios/App/App/public/` is repopulated by `cap sync` on every build from `apps/web/public/`. Committing it would duplicate content and create merge conflicts.
- Everything else (`.xcodeproj`, `.xcworkspace`, Swift sources, storyboards, asset catalogs, `Info.plist`, `Podfile`, `Podfile.lock`) is committed so the Xcode project opens identically for any future contributor.

**Alternatives considered**:

- **Gitignore the entire `ios/` directory and regenerate on demand**: `cap add ios` is not deterministic across Capacitor versions, and contributors would need Xcode locally just to test the wrapper. Rejected.
- **Only commit `.xcodeproj/` and nothing else**: the workspace and CocoaPods setup would rot quickly. Rejected.

---

## Decision 9 — NestJS CORS configuration

**Decision**: `APP_CORS_ORIGINS` on Railway must contain `https://kebi-app-ten-phi.vercel.app` in every environment the iOS app targets. This is an operational change to an env var, not a backend code change, and therefore does not violate FR-005.

**Rationale**:

- With C2, the WKWebView's document origin is the Vercel domain, and its JS makes cross-origin requests to Railway. Railway must send `Access-Control-Allow-Origin: https://kebi-app-ten-phi.vercel.app` for preflight to succeed.
- Today's web bundle does not actually need the Vercel domain in `APP_CORS_ORIGINS` because it uses the Vercel rewrite (same-origin from the browser's perspective). Adding it is additive and causes no regression.
- `credentials: true` in `services/api/src/main.ts:31` forbids `origin: '*'`, so each origin must be listed explicitly.
- The `deployment.md` example already shows `https://kebi-app.vercel.app` as an example value, suggesting the maintainer's intent was always to have the Vercel origin in the list. The C2 design simply makes that requirement load-bearing instead of aspirational.

**Alternatives considered**:

- **Open the CORS list to `*`**: fails with `credentials: true`. Rejected.
- **Add a NestJS-side change that relaxes CORS for `/api/v1/chat` specifically**: violates FR-005 (backend source edit). Rejected.
- **Use a reverse proxy inside Capacitor**: massive over-engineering, and pointless since Vercel is already loading the HTML. Rejected.

---

## Decision 10 — Preview deployments

**Decision**: Out of scope. `server.url` is hardcoded to `https://kebi-app-ten-phi.vercel.app` (production). Preview URL testing from the iOS shell is deferred.

**Rationale**:

- Every Vercel preview deployment has a unique URL. Supporting preview deploys from the iOS shell would require either (a) a build-time env override for `server.url`, (b) a per-build CORS origin update on Railway, or (c) an in-app URL picker. All out of proportion for a personal dev build.
- The owner can test UI changes against preview deployments in a browser on the iPhone (mobile Safari) before cutting a production deploy.

**Alternatives considered**:

- **Make `server.url` read from an env var that gets baked in at Capacitor build time**: doable, but deferred.
- **Ship multiple iOS build schemes** (preview / staging / prod): over-scoped. Rejected.

---

## Decision 11 — iOS minimum version

**Decision**: iOS 14+ (Capacitor 6 default). Do not override.

**Rationale**:

- Capacitor 6's default iOS deployment target is 14.0. The owner's personal iPhone is almost certainly on a recent iOS (17 or 18 as of 2026).
- Lowering the target to 13 buys nothing for a personal build.
- Raising the target to 17+ would buy nothing and lock out older simulators.

**Alternatives considered**:

- **Explicit `ios.deploymentTarget = '16.0'`** in `capacitor.config.ts`: low-value micromanagement. Deferred.

---

## Decision 12 — Agent context updates

**Decision**: Run `.specify/scripts/bash/update-agent-context.sh claude` after writing the plan, to append Capacitor + `@capacitor/geolocation` + the C2 architecture to CLAUDE.md's Active Technologies and Recent Changes markers.

**Rationale**:

- Future Claude sessions opening this repo will benefit from knowing (a) that the iOS shell exists and (b) that the chat client has an `isNativePlatform` branch to preserve.
- The script is idempotent and only modifies content between marker comments.

---

## Open items deferred to implementation

The following items are not research questions — they are implementation-time verifications or owner actions:

- **`NEXT_PUBLIC_API_URL` present in Vercel env**: verify via `vercel env ls` or the Vercel dashboard before T003 is tested. If missing, set it and redeploy.
- **`APP_CORS_ORIGINS` contains the Vercel domain on Railway**: verify via `railway variables` or the Railway dashboard. If missing, add it.
- **`kebi-config/deployment.md` update**: sibling-repo doc edit; committed separately from this feature branch.
- **Exact Clerk frontend API host**: derivable at implementation time from the publishable key if the wildcard-based `allowNavigation` turns out to be insufficient. Verify during first sign-in in Xcode Simulator.
- **First-run Xcode steps** (Apple ID, team selection, developer cert trust, run-on-device): owner actions, documented in `quickstart.md`.
