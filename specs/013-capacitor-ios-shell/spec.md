# Feature Specification: Capacitor iOS Shell for Kebi Web

**Feature Branch**: `013-capacitor-ios-shell`
**Created**: 2026-04-13
**Status**: Draft
**Input**: User description: "Wrap apps/web in a Capacitor iOS shell so Kebi runs as a native iOS app on an iPhone, talking directly to the Railway-hosted NestJS backend. No Next.js API routes. Stop at the Xcode open step and hand off to the owner to run on device."

## Clarifications

### Session 2026-04-13

- Q: How should the iOS shell load the web app — bundle a static export, load the live Vercel deployment as a remote URL, or hybrid? → A: **Remote-URL shell with API calls direct to Railway (variant C2)**. The Capacitor iOS WebView loads its HTML/JS/CSS from the existing Vercel deployment of `apps/web` via Capacitor's `server.url`. Only the API client is changed: a runtime check for native platform switches outbound `/api/v1/*` calls to absolute Railway URLs, bypassing the Vercel rewrite. No static export, no `output: 'export'`, no middleware staging, no `generateStaticParams`. The web build remains byte-identical to today.
- Q: Does the iOS shell need `@capacitor/geolocation`, given the web app already calls `navigator.geolocation`? → A: **Yes — install the plugin**. Its primary value here is auto-injecting the iOS `Info.plist` location-permission key (`NSLocationWhenInUseUsageDescription`) during `cap sync`, which `navigator.geolocation` in the WKWebView silently fails without. No JS code change is required; the existing browser geolocation call continues to work, but now actually receives a permission prompt and a real location on iOS.
- Q: Which Vercel URL does Capacitor `server.url` point at? → A: **`https://kebi-app-ten-phi.vercel.app`** — the production deployment of `apps/web`. This URL is the iOS shell's HTML/JS/CSS host, and it is also the value that MUST be added to NestJS `APP_CORS_ORIGINS` in every Railway environment the iOS app is built against.
- Q: How should Apple sign-in work inside the iOS WebView, given that Apple's OAuth page blocks WKWebView user agents? → A: **Hide the Apple button inside the iOS shell; keep Google as the only sign-in option on iOS.** The existing `login/page.tsx` gets a runtime `Capacitor.isNativePlatform()` check that hides the Apple CTA when running inside Capacitor. The Apple button remains visible in the browser web app because web users are not inside a WKWebView. Native Sign in with Apple (via `@capacitor-community/apple-sign-in` + Clerk custom-token) is explicitly deferred to a follow-up feature and is out of scope here.
- Q: What iOS bundle identifier and display name should Capacitor lock in? → A: **`appId: "com.kebi-app.app"`, `appName: "Kebi"`.** Committed to `apps/web/capacitor.config.ts`. This is a placeholder reverse-DNS identifier that does not assume ownership of any domain and is trivially editable inside Xcode later if the owner chooses to tie it to an Apple Developer team namespace.
- Q: First-run iOS smoke test surfaced that **Google's OAuth provider also blocks WKWebView user agents** (Error 403: `disallowed_useragent`), not just Apple's. Q3's "hide Apple, keep Google" decision was insufficient. How should iOS users sign in? → A: **Email code sign-in on iOS only.** When `Capacitor.isNativePlatform()` is `true`, hide BOTH OAuth buttons and show Clerk's `email_code` flow (enter email → receive 6-digit code → enter code → signed in). The entire flow runs inside WKWebView, no external browser, no `disallowed_useragent`. Web users continue to see Google + Apple buttons unchanged. Owner action prerequisite: confirm Clerk dashboard has Email address enabled as an identifier and Email verification code enabled as a first factor (default for most Clerk instances). Native Sign in with Google/Apple via Capacitor plugins is deferred to a follow-up feature, as is Option 1's `SFSafariViewController` + ticket-handoff approach (~150–200 lines, scope expansion).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run Kebi as a Native iOS App (Priority: P1)

As the product owner, I want to open Kebi on my iPhone as a standalone native app icon — not a browser tab — so I can use and demo the product the way a real user eventually will, while still talking to the live backend on Railway.

**Why this priority**: This is the entire purpose of the feature. Everything else (configuration, URL routing, verification) exists only to make this one experience work.

**Independent Test**: The owner can open the generated iOS project in Xcode, build it, and see the Kebi home screen launch inside a native iOS app shell (simulator or personal device), with the same layout and branding as the web app.

**Acceptance Scenarios**:

1. **Given** the owner has completed the setup steps through the "open in Xcode" handoff, **When** they build and run the project in Xcode, **Then** the iOS app launches and displays the Kebi home screen identical to `apps/web` in a browser.
2. **Given** the iOS app is running on device or simulator, **When** the user sends a chat message, **Then** the request reaches the Railway-hosted NestJS backend and a response is rendered inside the app.
3. **Given** the iOS app is running, **When** the user signs in, **Then** authentication succeeds and the authenticated state persists across app relaunches.

---

### User Story 2 - Backend URL Stays Configurable (Priority: P1)

As the product owner, I want the backend base URL the iOS app calls to come from environment configuration rather than a hardcoded literal in source, so I can repoint the same native shell at local, staging, or production without editing and re-committing code.

**Why this priority**: Hardcoding the Railway URL would lock the iOS shell to a single environment and would violate the project's zero-hardcoding standard. This has to be right from day one or it will be painful to retrofit later.

**Independent Test**: Changing the configured backend base URL and rebuilding the iOS app causes the app to talk to the new URL, with no source code diff required.

**Acceptance Scenarios**:

1. **Given** the backend URL is defined in environment configuration, **When** the iOS app is built and launched, **Then** all outbound API traffic targets that URL.
2. **Given** the configured URL is changed to a different environment, **When** the iOS app is rebuilt, **Then** subsequent traffic goes to the new environment without any source file edits.

---

### User Story 3 - Zero Impact on Backend and Infrastructure (Priority: P1)

As the product owner, I want adding the iOS shell to have zero effect on the NestJS backend, the FastAPI AI service, and the Railway deployment footprint, so iOS work does not risk destabilizing the already-working web product.

**Why this priority**: The backend is stable and serves the web app. An iOS wrapper should be purely additive. Any regression here blocks both platforms.

**Independent Test**: After the feature is implemented, `services/api/` and `kebi/` have no diffs attributable to this work, and the Railway project has no new services.

**Acceptance Scenarios**:

1. **Given** the feature is complete, **When** inspecting diffs against `main`, **Then** no files under `services/api/` were modified for iOS purposes.
2. **Given** the feature is complete, **When** listing Railway services, **Then** the set of services is identical to before the feature started.
3. **Given** the web app is deployed as usual, **When** used in a browser, **Then** it behaves identically to before the iOS work.

---

### User Story 4 - Web Build Stays Untouched (Priority: P2)

As the product owner, I want the existing browser experience on Vercel to remain byte-identical after the iOS shell is added, so iOS work cannot regress the web product. The C2 architecture chosen during clarification achieves this by reusing the live Vercel deployment as the iOS HTML host and adding only a runtime "am I native?" branch in the API client — no static export, no middleware changes, no rewrite changes.

**Why this priority**: The browser web app is the production surface today. Any regression there blocks both platforms.

**Independent Test**: After implementation, the web app behaves identically when opened in a desktop or mobile browser, and a `git diff` of `apps/web` shows changes only in the API client transport plus new Capacitor config files — nothing in `middleware.ts`, `next.config.js`, or any route file.

**Acceptance Scenarios**:

1. **Given** the feature is complete, **When** the web app is loaded in a browser, **Then** auth gating, routing, fonts, i18n, and chat all behave identically to before the feature.
2. **Given** the feature is complete, **When** inspecting the diff against `dev`, **Then** no edits exist in `apps/web/src/middleware.ts`, `apps/web/next.config.js`, or any file under `apps/web/src/app/[locale]/` that would alter web behavior.

---

### Edge Cases

- **Vercel as the iOS HTML host**: Per the C2 clarification, the iOS WebView loads its HTML/JS/CSS from the existing Vercel deployment of `apps/web`. Vercel therefore becomes a runtime dependency of the iOS app for shell delivery: if Vercel is down, the iOS app cannot launch fresh. API traffic, however, bypasses Vercel entirely (see FR-002b).
- **WebView origin for CORS**: Because the iOS WebView is loaded from `https://<vercel-domain>` and then makes cross-origin calls to `https://<railway-domain>/api/v1/*`, the Vercel domain MUST be present in the NestJS `APP_CORS_ORIGINS` env var alongside any existing entries. This is a per-environment env-var change in Railway, not a backend source edit.
- **Authentication from a Vercel-origin WebView**: Sign-in flows happen inside a Capacitor WKWebView whose document origin is the Vercel domain — the same origin the production web app uses. Cookies, redirects, and Clerk allowed-origin checks behave the same as in mobile Safari. Any third-party OAuth redirect that the WebView is expected to follow MUST be in the Capacitor `allowNavigation` allowlist.
- **iOS location permissions**: Per the geolocation clarification, the `@capacitor/geolocation` plugin is installed solely to inject the `NSLocationWhenInUseUsageDescription` key into the iOS `Info.plist` during `cap sync`. Without it, `navigator.geolocation` silently fails inside the WebView with no permission prompt.
- **Runtime native-platform detection**: The API client distinguishes "running inside Capacitor on iOS" from "running in a browser on Vercel" via a runtime check (`Capacitor.isNativePlatform()`). The same `apps/web` source ships to both targets unchanged otherwise.
- **Handoff boundary**: The feature stops at "Xcode project is open and ready to run". Everything after that — provisioning profiles, signing with an Apple developer account, trusting the developer cert on the device, running on the physical iPhone — is the owner's responsibility and must be handed off as clear written instructions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The existing `apps/web` frontend MUST be wrapped as a native iOS application shell without forking the UI codebase. Per the C2 clarification, this is achieved by pointing Capacitor's `server.url` at the existing Vercel deployment of `apps/web`, not by producing a static export.
- **FR-002**: All API traffic (the `/api/v1/*` requests) from the iOS app MUST go directly to the Railway-hosted NestJS backend, bypassing the Vercel rewrite. The iOS API client MUST detect that it is running inside Capacitor at runtime and prepend the absolute Railway base URL to outbound requests.
- **FR-002b**: The iOS app is permitted to load its HTML/JS/CSS shell from the existing Vercel deployment of `apps/web` via Capacitor `server.url`. Vercel is therefore in the path for shell delivery only, not for API traffic.
- **FR-003**: The runtime native-platform detection in the API client MUST default to existing browser behavior (relative `/api/v1/*` paths plus the Vercel rewrite) when not running inside Capacitor, so the web bundle's behavior is unchanged.
- **FR-004**: The Railway backend base URL used by the iOS-mode API client MUST come from environment configuration (`NEXT_PUBLIC_API_URL` or equivalent), not from a hardcoded literal in source code.
- **FR-005**: The feature MUST NOT modify any backend source under `services/api/` or `kebi/`. Adding the Vercel domain to the NestJS `APP_CORS_ORIGINS` env var in Railway is a configuration change, not a source change, and is permitted.
- **FR-006**: The feature MUST NOT provision, rename, or remove any Railway service.
- **FR-007**: The native iOS shell MUST render the same UI and branding as the web app, with no feature removals or visual divergence introduced by the wrapping step.
- **FR-008**: Authentication (Clerk) MUST continue to work inside the native iOS WebView so the owner can sign in and use the app end-to-end. Any third-party OAuth redirect domain the sign-in flow uses MUST be added to the Capacitor `allowNavigation` allowlist.
- **FR-008b**: The existing `login/page.tsx` MUST hide BOTH the "Continue with Apple" and "Continue with Google" buttons when running inside Capacitor (`Capacitor.isNativePlatform() === true`), because both Apple's and Google's OAuth providers block WKWebView user agents (Apple: "unsafe browser"; Google: Error 403 `disallowed_useragent`). Both buttons MUST remain visible in the browser web bundle. Native Sign in with Google/Apple via Capacitor plugins is out of scope for this feature.
- **FR-008c**: When `Capacitor.isNativePlatform() === true`, `login/page.tsx` MUST present Clerk's `email_code` sign-in flow as the iOS sign-in path: a two-step form that takes an email address, calls `signIn.create({ identifier })` and `signIn.prepareFirstFactor({ strategy: 'email_code' })` to send a 6-digit code, then `signIn.attemptFirstFactor({ strategy: 'email_code', code })` to complete sign-in inside the WKWebView. The Clerk dashboard MUST have Email address enabled as an identifier and Email verification code enabled as a first factor; this is an owner-action prerequisite, not a code change.
- **FR-009**: `@capacitor/geolocation` MUST be installed and `cap sync` MUST be run, so the iOS `Info.plist` receives the `NSLocationWhenInUseUsageDescription` key required for `navigator.geolocation` to function inside the WKWebView.
- **FR-010**: The work MUST stop at the point where the Xcode project is opened and ready for the owner, and the owner MUST receive clear written handoff instructions for the remaining on-device steps (Xcode signing, device trust, running on iPhone).
- **FR-011**: Adding the iOS shell MUST NOT degrade the existing browser-based web experience. The web bundle continues to use relative `/api/v1/*` paths and the existing Vercel rewrite.

### Key Entities

Not applicable. This feature adds a new delivery surface for an existing app. It introduces no new user-facing data entities and no new persisted state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The product owner can open the generated Xcode project and, following the written handoff instructions, build and launch the Kebi app inside an iOS environment (simulator or device) on the first attempt, with no extra investigation required.
- **SC-002**: From the launched iOS app, the owner can complete a full end-to-end interaction (sign in, send a chat message, receive a response) where every outbound request is served by the Railway NestJS backend.
- **SC-003**: The feature introduces zero diffs to files under `services/api/` and `kebi/`.
- **SC-004**: The feature introduces zero new Railway services.
- **SC-005**: Pointing the iOS shell at a different backend environment is achievable by changing configuration only, with no source file edits.
- **SC-006**: A `git diff` of `apps/web` after implementation contains no edits to `middleware.ts`, `next.config.js`, or any route file under `src/app/[locale]/`. Edits are confined to the API client transport, new Capacitor config, and the iOS native project.
- **SC-007**: After the feature ships, the web app continues to function in a browser with the same behavior it had before the feature started.
- **SC-008**: The Vercel domain appears as a value in `APP_CORS_ORIGINS` for every Railway environment that the iOS app is built against, and the iOS app successfully completes a chat round-trip in each.

## Assumptions

- The target platform for this first pass is **iOS only**. Android wrapping, App Store submission, and push notifications are explicitly out of scope.
- The iOS build is a **developer/personal build** for the owner's own iPhone and simulator, not a production App Store release. Apple Developer account setup, signing identities, and provisioning profiles are outside the scope of this feature and are handled manually by the owner during the Xcode handoff step.
- The **production Vercel deployment of `apps/web`**, currently at `https://kebi-app-ten-phi.vercel.app`, is the `server.url` target for the iOS shell, and the **production Railway backend** is the default target of its API calls. Local loopback to a dev backend is not required for this feature.
- **Authentication (Clerk)** is assumed to work inside a Capacitor WKWebView whose document origin equals the Vercel domain. Because that is the same origin the production web app already uses, no Clerk dashboard configuration changes are anticipated. Any third-party OAuth redirect domain used by the sign-in flow will be added to Capacitor's `allowNavigation` allowlist.
- The owner retains full control of the on-device portion of the workflow (Xcode signing, device trust, first install). The feature ends at "Xcode project is open and ready".
- Adding the Vercel domain to the NestJS `APP_CORS_ORIGINS` env var in Railway is treated as configuration, not source code, and is therefore not blocked by FR-005.

## Out of Scope

- Android app, Play Store, or any non-iOS platform.
- App Store submission, TestFlight distribution, or any code-signing automation.
- Push notifications, background tasks, deep links, or native-only features beyond "display the web app".
- Any backend or AI-service code changes.
- Any new Railway services or infrastructure changes.
- A separate native UI or native component library — the iOS shell renders the existing web UI only.
- Offline mode or on-device persistence beyond whatever the web app already does in a browser.
- Native Sign in with Apple via `@capacitor-community/apple-sign-in` or Clerk custom tokens — deferred to a follow-up feature.
