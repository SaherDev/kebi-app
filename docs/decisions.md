# Architecture Decisions Log — Kebi

Log of architectural decisions. Add new entries at the top.

Each ADR describes a problem and the chosen approach, not implementation mechanics. The acid test: a paragraph that would need rewriting when code is refactored does not belong here — it belongs in the code, in tests, or in the PR description.

Format:

```
## ADR-NNN: Title
**Date:** YYYY-MM-DD\
**Status:** accepted | superseded | deferred\
**Context:** The problem and the constraints.
**Decision:** The chosen approach.
**Consequences:** What changes for users, operators, and future maintainers.
```

---

## ADR-042: Switch auth from Clerk to Supabase

**Date:** 2026-06-02\
**Status:** accepted\
**Context:** Clerk was our auth provider (ADR-004). We are moving to Supabase Auth. The gateway was already built to swap providers behind the `IdentityProvider` interface (ADR-033), so this is a provider change, not a rewrite. The active client is the Expo app; `apps/web` is parked (ADR-040) and stays on Clerk for now.\
**Decision:** Use Supabase Auth instead of Clerk. Users sign in with email, Google, or phone/SMS; Apple is deferred until the paid Apple Developer account is active. The gateway verifies Supabase tokens with the project's public keys (JWKS), and the user's plan/movement settings travel inside the token as they did with Clerk (amends ADR-037 — that data now comes from Supabase). We start fresh: existing Clerk users are not migrated. Clerk stays wired in parallel until Supabase is fully set up, so going live is a one-line config flip with instant rollback. Supersedes ADR-004.\
**Consequences:** Email and Google sign-in work on the free tier; SMS needs a paid SMS provider. The Clerk webhook and SDK are removed once Supabase is verified end-to-end. `apps/web`'s Clerk code is left untouched until that app is revived.

---

## ADR-041: No dummy data — contract-first data flow

**Date:** 2026-05-31\
**Status:** accepted\
**Context:** The native client is built against an evolving kebi HTTP contract. Without a rule, missing backend fields get stubbed in the frontend — producing throwaway code that drifts from the real response and silently hides contract gaps.\
**Decision:** No dummy, mock, placeholder, or stub data in any frontend for product flows. When a screen needs a field or endpoint that does not yet exist end-to-end, build it server-side first (contract → shared types → gateway and kebi), then build the UI against the live response. Test fixtures inside test files are exempt.\
**Consequences:** Screens may start slower because server-side work is a prerequisite, but every shipped screen is backed by a real, tested contract. This is a Constitution Check item — plans proposing fixture data for a product flow are flagged and revised.

---

## ADR-040: Park apps/web and libs/ui pending the native mobile rebuild

**Date:** 2026-05-29\
**Status:** accepted\
**Context:** The product is pivoting to a native React Native (Expo) app as the primary client; `apps/web` is frozen and no longer compiles after `libs/shared` was stripped to the live contract types. Left in the build graph, its broken typecheck blocks the active projects.\
**Decision:** Park `apps/web` and `libs/ui` (the web-only design-system lib) — exclude them from the build graph without deleting them. The code stays in-tree as reference. Web is removed once mobile reaches parity, or revived if the pivot reverses.\
**Consequences:** `apps/web` and `libs/ui` are intentionally excluded from CI/lint/test/build. The go-forward client is `apps/mobile` (Expo, NativeWind).

---

## ADR-037: Gateway speaks the hardened kebi contract; movement_profile rides the token _(claim source amended by ADR-042)_

**Date:** 2026-05-29\
**Status:** accepted\
**Context:** kebi hardened its HTTP contract — protected routes now require service-to-service auth headers plus a verified user id (no longer a body field), and several endpoints were reshaped or removed. The gateway was still on the old contract and could not authenticate to kebi at all. Separately, `movement_profile` (a per-turn mobility setting) needed a home, carried like the existing `plan`.\
**Decision:** Align the gateway with the current kebi contract: attach the shared-secret auth headers on every protected call (fail-closed if the secret is unset; it must match kebi exactly), pass the verified user id per call, and match the reshaped endpoints. `movement_profile` rides the auth token as a claim (like `plan`) and the gateway injects it server-side — the client never sends it. Shared contract types live in `libs/shared` as the single source of truth for both clients.\
**Consequences:** Gateway auth is a coordinated cross-repo change — the shared secret must match on both sides and the endpoints must deploy in lockstep with kebi's schema. A user-facing way to set `movement_profile` is still owed; until then kebi applies a neutral fallback.

---

## ADR-036: Single chat endpoint replaces the three-endpoint AI contract

**Date:** 2026-04-09\
**Status:** accepted\
**Context:** The gateway forwarded to three separate AI endpoints, which forced it to know the user's intent before forwarding — routing logic that belongs in the AI service. It also stored recommendation history, coupling it to AI response shapes.\
**Decision:** Replace the three endpoints with a single chat call; the AI service classifies intent internally and returns a typed response with a discriminated `type` field. The gateway always returns HTTP 200 for chat — error classification is the client's job via `type`; HTTP error codes are reserved for transport failures. The gateway no longer writes recommendation history. Supersedes ADR-016.\
**Consequences:** The frontend calls one chat endpoint for all interactions. SSE streaming is dropped here and can return in a future ADR when the frontend needs real-time reasoning steps.

---

## ADR-035: TypeORM as the ORM for the gateway

**Date:** 2026-04-09\
**Status:** accepted\
**Context:** The gateway manages exactly two tables (`users`, `user_settings`); a lightweight ORM is sufficient.\
**Decision:** Use TypeORM with schema auto-sync — acceptable while there is no production data at risk. It only manages the gateway's own tables; AI-owned tables stay fully owned by kebi's migrations.\
**Consequences:** Single-tool schema management on the gateway side. Move to explicit migrations once the team grows or production data accrues.

---

## ADR-034: Chain of Responsibility for request validation (deferred)

**Date:** 2026-03-14\
**Status:** deferred\
**Context:** Controllers use a global validation pipe. As domain-specific validation grows, a single method accumulates unrelated rules that are hard to test independently.\
**Decision:** Deferred. Adopt Chain of Responsibility once any single validation path exceeds three independent rules; until then, a single validation method per service is acceptable.\
**Consequences:** No work now. When triggered, each rule becomes an independently testable validator and adding a rule means adding a class, not editing one.

---

## ADR-033: Interface abstraction for all swappable dependencies

**Date:** 2026-03-14\
**Status:** accepted\
**Context:** The repo depends on external systems (auth, database, HTTP to kebi). Any dependency that has more than one possible implementation, could be swapped for cost/performance/availability, or needs mocking in tests should not be hardwired into business logic.\
**Decision:** Abstract any such dependency behind a TypeScript interface before writing the concrete class. Business code depends on the interface only; swapping a dependency is a config change plus a new implementation class, never a change to business logic.\
**Consequences:** Every qualifying external dependency is defined interface-first. This is a Constitution Check item — plans that wire a concrete dependency directly into business logic are flagged and revised.

---

## ADR-032: Facade pattern enforced on controllers

**Date:** 2026-03-14\
**Status:** accepted\
**Context:** Without a constraint, controllers accumulate business logic, direct database calls, and inline forwarding — coupling the HTTP layer to infrastructure and hurting testability.\
**Decision:** Controllers are facades. Each method makes one service call and returns the result — no database access, no AI-client calls, no business logic. All orchestration lives in the service layer. Guards and pipes (decorators) do not count as logic.\
**Consequences:** Controllers stay thin and infrastructure is testable independently of routing. Violations are flagged during Constitution Check.

---

## ADR-031: Agent skills scoped to workflow stages

**Date:** 2026-03-12\
**Status:** accepted\
**Context:** The project uses Claude Code agent skills. Without a strategy, skills get invoked at the wrong stage — wasting tokens or missing optimization opportunities.\
**Decision:** Scope each skill to a workflow stage (per ADR-028) and invoke it only when both the skill's domain and the current stage match. The concrete skill-to-stage mapping is maintained in `.claude/workflows.md` (so it can evolve with the installed skill set without touching this log).\
**Consequences:** Focused guidance at the right moment and lower token cost. The skill set is configured in the repo and available every session.

---

## ADR-030: Interfaces implemented only via classes, never factory functions

**Date:** 2026-03-11\
**Status:** accepted\
**Context:** Injectable abstractions can be built via factory functions or classes. Factories are lighter but hide the shape of what's created; classes are explicit and composable.\
**Decision:** Implement all interfaces via classes that explicitly implement them, never factory functions. This keeps the type visible in code and enables constructor-based dependency injection.\
**Consequences:** Every transport and service is a class; dependency injection works the same way everywhere; the concrete type is discoverable instead of hidden behind a factory.

---

## ADR-029: Injected HTTP client transport for apps/web

**Date:** 2026-03-11\
**Status:** accepted\
**Context:** Inline fetch calls make it hard to swap the HTTP client, reuse calls, or change the base URL in one place, and they couple components to a specific implementation.\
**Decision:** Route all of `apps/web`'s HTTP through an injectable `HttpClient` interface with class-based transports; nothing outside the api layer imports a HTTP library directly. Reads are plain query functions, mutations are Server Actions, and both share the transport. Client components obtain tokens via a hook that wraps the client with the auth provider's token getter. Errors propagate as a typed error for components to handle.\
**Consequences:** Swapping transports changes one class; components stay thin with typed responses; reads keep Next.js caching. Targets `apps/web`, currently parked per ADR-040.

---

## ADR-028: 5-Step token-efficient workflow

**Date:** 2026-03-09\
**Status:** accepted\
**Context:** The prior workflow was unclear about when to use agents, wasting tokens through unnecessary dispatches. Needed an approach that scales from one-file tasks to multi-repo changes.\
**Decision:** Adopt a 5-step workflow — Clarify → Plan → Implement → Verify → Complete — with planning gated on size (3+ files or a cross-repo boundary) and a Constitution Check against this log during the Plan step. Step-by-step detail and per-step model assignments live in `.claude/workflows.md`.\
**Consequences:** Far lower average task cost, clear plan-vs-implement decision points, and architectural violations caught in the Plan phase rather than mid-implementation. Applies across repos.

---

## ADR-027: _(reserved — unused)_

---

## ADR-026: Database migration ownership split _(superseded by ADR-035)_

**Date:** 2026-03-09\
**Status:** superseded\
**Context:** Originally defined how two ORM tools would share one PostgreSQL instance.\
**Decision:** Superseded by ADR-035. The gateway owns its two product tables; kebi's Alembic owns all AI tables.

---

## ADR-025: Secrets in gitignored local files, non-secrets in committed config

**Date:** 2026-03-09\
**Status:** accepted\
**Context:** Secrets must never be in version control, and each service needs simple, self-contained secret management.\
**Decision:** Keep secrets in gitignored per-service local files (sourced from a shared secrets store, `kebi-config/secrets`) and non-secret config in committed files. In production the platform injects the same names as environment variables. Secret files are never committed.\
**Consequences:** Non-secret config is reviewable in version control; secrets stay isolated. Deploy-time variable names are canonical and must match the local names for parity.

---

## ADR-024: Zustand for client-side UI state

**Date:** 2026-03-08\
**Status:** accepted\
**Context:** The frontend needs minimal global client UI state; most data is server state, so a full solution like Redux would be overkill.\
**Decision:** Use Zustand for lightweight shared UI state in `apps/web`. Server state stays in the data-fetching layer; auth, locale, and theme stay with their existing owners; component-local state stays in `useState`.\
**Consequences:** Lean client bundle and no Redux boilerplate. Zustand is only for cross-component UI state.

---

## ADR-023: Response shaping through DTOs

**Date:** 2026-03-08\
**Status:** accepted\
**Context:** Returning raw entities or AI response objects from controllers would leak internal fields and couple the response shape to the persistence layer.\
**Decision:** Shape every controller response through a response DTO via a serialization decorator that drops non-exposed fields. Raw entities and AI objects are never returned directly.\
**Consequences:** Response shape is decoupled from persistence; adding or removing a response field is a DTO edit; controllers stay clean.

---

## ADR-022: AI access gated by a per-user flag and a global kill switch

**Date:** 2026-03-08\
**Status:** accepted\
**Context:** AI calls to kebi are expensive and may need disabling — globally (outage, cost control) or per-user (abuse). This must be enforced at the gateway before any forwarding.\
**Decision:** A guard on AI routes checks a global kill switch (an env flag, togglable without a redeploy) and a per-user `ai_enabled` flag from the verified token. Either can block AI access (503 global, 403 per-user) while the rest of the API keeps working. New users default to AI-enabled.\
**Consequences:** AI can be killed globally without a redeploy and per-user without code changes. The guard depends on auth running first to populate the user.

---

## ADR-021: Bruno over Swagger for API documentation

**Date:** 2026-03-08\
**Status:** accepted\
**Context:** The API needs documentation and testing. Swagger would duplicate the contract already maintained in `docs/api-contract.md` and add runtime overhead.\
**Decision:** No Swagger. Use Bruno for API testing and documentation; every new endpoint gets a Bruno request file. `docs/api-contract.md` stays the human-readable contract source.\
**Consequences:** No Swagger decorators or UI. A Bruno file is the signal that an endpoint is documented and testable.

---

## ADR-020: pnpm as the package manager (supersedes ADR-006)

**Date:** 2026-03-07\
**Status:** accepted\
**Context:** The repo was initially on Yarn (ADR-006). pnpm has stricter dependency isolation, faster installs, and good Nx monorepo support.\
**Decision:** pnpm is the package manager for the whole monorepo; workspace packages reference each other via the workspace protocol; only the pnpm lockfile is committed. Supersedes ADR-006.\
**Consequences:** Phantom-dependency bugs surface earlier from strict hoisting. Developers must have pnpm installed.

---

## ADR-019: Forward-compatible DTOs for AI service responses

**Date:** 2026-03-07\
**Status:** accepted\
**Context:** The kebi response schema will evolve and clients must not fail on extra keys. DTOs that reject unknown fields would break when kebi adds fields.\
**Decision:** AI-response DTOs declare known fields as optional and do not strip unknown fields — they pass through to the client.\
**Consequences:** The gateway tolerates kebi API evolution and the frontend receives new fields as they appear. DTOs are updated when a field becomes business-required.

---

## ADR-018: Global exception filter for upstream errors

**Date:** 2026-03-07\
**Status:** accepted\
**Context:** kebi returns several error and timeout conditions that need different user-facing messages. Without a translation layer, error handling would be duplicated across every controller.\
**Decision:** A global exception filter catches AI-service and framework errors and maps them to consistent client responses (for example, upstream 5xx/timeout → 503 with a retry suggestion).\
**Consequences:** All controllers get consistent error translation; changes live in one filter; no raw upstream errors reach the frontend.

---

## ADR-017: Global validation in whitelist mode

**Date:** 2026-03-07\
**Status:** accepted\
**Context:** Without global validation, invalid request bodies reach services and cause hard-to-debug errors; without whitelisting, extra client fields leak into logic.\
**Decision:** Register a global validation pipe in whitelist mode that rejects unknown fields and transforms payloads into typed DTO instances; request DTOs carry validation decorators.\
**Consequences:** Invalid requests are rejected before controllers; DTOs are the authoritative contract for incoming data.

---

## ADR-016: A single client encapsulating all forwarding to kebi _(superseded by ADR-036)_

**Date:** 2026-03-07\
**Status:** superseded\
**Context:** Multiple domains needed to call kebi; without a shared abstraction each would duplicate base URL, timeouts, and error handling.\
**Decision:** Superseded by ADR-036. Originally: wrap all kebi forwarding behind a single injectable client with configured base URL, per-endpoint timeouts, and one place to add the service-to-service auth header.\
**Consequences:** Superseded by ADR-036 (single chat endpoint).

---

## ADR-015: Global singleton DB provider _(superseded by ADR-035)_

**Date:** 2026-03-07\
**Status:** superseded\
**Context:** Originally specified the shape of a global DB service provider.\
**Decision:** Superseded by ADR-035. TypeORM now provides the global data source and domain services inject repositories.

---

## ADR-014: One module per domain bounded context

**Date:** 2026-03-07\
**Status:** accepted\
**Context:** Without module boundaries, the gateway's services become a coupled monolith where any service can call any other.\
**Decision:** One module per domain, each with its own controller, service, and DTOs; the app module composes them. No cross-domain service injection — domains integrate only through the AI client.\
**Consequences:** Adding a domain is one new module; responsibilities stay narrow; DTOs stay local unless promoted to `libs/shared`.

---

## ADR-013: Auth applied globally with a public-path opt-out

**Date:** 2026-03-07\
**Status:** accepted\
**Context:** Every authenticated endpoint needs token verification. Per-controller checks are error-prone — a missed guard means an open endpoint. Auth must hold at both the web edge (page protection) and the API (endpoint protection).\
**Decision:** Apply auth globally with an explicit public-path opt-out, at two layers: the web edge protects all pages except matched public routes, and the gateway verifies bearer tokens on all routes except a configured public-paths list, attaching the verified user to the request. Public access is driven by config, not decorators.\
**Consequences:** No accidentally-unprotected pages or endpoints; the verified user is available to all handlers; config is the single source of truth for public routes. Provider specifics are per ADR-042.

---

## ADR-012: YAML config module for non-secret configuration

**Date:** 2026-03-07\
**Status:** accepted\
**Context:** The gateway needs non-secret config values; using env vars for non-secrets defeats YAML config (ADR-003), and ad-hoc lookups are fragile.\
**Decision:** Register a global config module with a YAML loader keyed by environment, inject a typed config service wherever config is needed, and address non-secret keys by dot-notation paths.\
**Consequences:** Non-secret config is version-controlled and environment-specific; adding a key is a YAML edit, not a code change.

---

## ADR-011: Fail fast on missing PORT at bootstrap

**Date:** 2026-03-07\
**Status:** accepted\
**Context:** If `PORT` is unset, the app would bind to an undefined port and fail silently or confusingly.\
**Decision:** At bootstrap, check for `PORT` and throw a clear, actionable error before listening if it is missing.\
**Consequences:** Misconfigured environments fail fast with a clear fix instruction; pattern set for future required-env guards.

---

## ADR-010: Global API prefix driven by a shared constant

**Date:** 2026-03-07\
**Status:** accepted\
**Context:** The `/api/v1` prefix must stay consistent across the gateway's routing and any client that builds URLs to it; hardcoding it in one place risks drift.\
**Decision:** Define the prefix once as a shared constant in `libs/shared` and consume it from both the gateway and clients.\
**Consequences:** Changing the prefix is a one-constant edit.

---

## ADR-009: SSE streaming as a future consult response mode _(superseded by ADR-036)_

**Date:** 2026-03-05\
**Status:** superseded\
**Context:** The consult response was synchronous; showing agent thinking in real time would have required a mid-build contract redesign without a plan.\
**Decision:** Superseded by ADR-036. Originally documented SSE as a future streaming mode, kept synchronous as the default until needed.\
**Consequences:** Superseded by ADR-036.

---

## ADR-008: reasoning_steps in the consult response

**Date:** 2026-03-05\
**Status:** accepted\
**Context:** When a bad recommendation comes back there is no way to tell which stage failed, and the eval pipeline needs per-step measurement.\
**Decision:** The response includes a `reasoning_steps` array — each entry a step identifier plus a human-readable summary. kebi produces it; this repo renders it.\
**Consequences:** The frontend can display agent thinking steps; the contract carries the field.

---

## ADR-007: Tailwind v3 + shadcn/ui over Tailwind v4

**Date:** 2026-03-04\
**Status:** accepted\
**Context:** The UI needs a component library (Dialog, Sheet, Toast, Skeleton, Command). Tailwind v4 was available but shadcn/ui was not fully stable on it at project start.\
**Decision:** Use Tailwind v3 with shadcn/ui, with shadcn components copied into the design-system lib (owned, not a dependency) so they can be modified freely.\
**Consequences:** Fully customizable components with no upstream dependency; a future v4 upgrade would need re-testing. Applies to `apps/web`/`libs/ui`, now parked per ADR-040.

---

## ADR-006: Yarn over npm/pnpm _(superseded by ADR-020)_

**Date:** 2026-03-04\
**Status:** superseded\
**Context:** A package manager was needed for the Nx monorepo at project creation, avoiding PnP compatibility issues.\
**Decision:** Superseded by ADR-020. The repo has since migrated to pnpm.

---

## ADR-005: Initial ORM choice _(superseded by ADR-035)_

**Date:** 2026-03-04\
**Status:** superseded\
**Context:** Initial ORM decision for the gateway.\
**Decision:** Superseded by ADR-035. Current ORM: TypeORM.

---

## ADR-004: Clerk over custom auth _(superseded by ADR-042)_

**Date:** 2026-03-04\
**Status:** superseded\
**Context:** Implementing auth from scratch would consume weeks better spent on AI features.\
**Decision:** Superseded by ADR-042. Originally: use Clerk across both runtimes for its free tier and SDKs.\
**Consequences:** Superseded by ADR-042 (Supabase Auth).

---

## ADR-003: YAML config over dotenv for non-secrets

**Date:** 2026-03-04\
**Status:** accepted\
**Context:** Non-secret config values need structure and environment-specificity that flat `.env` files cannot provide cleanly.\
**Decision:** Use YAML files for all non-secret configuration; keep secrets in gitignored per-repo local files; commit no secret files.\
**Consequences:** Config is structured and version-controlled; secrets never appear in config; adding a non-secret value is a YAML edit.

---

## ADR-002: Separate AI repo (kebi)

**Date:** 2026-03-04\
**Status:** accepted\
**Context:** All AI/ML logic needs Python, a different deployment target, and a faster iteration cycle; mixing languages in one repo would complicate CI, deploys, and dependency management.\
**Decision:** Keep all AI/ML code in a separate Python repository (kebi); this repo communicates with it over HTTP only.\
**Consequences:** A stable HTTP contract is the boundary between repos; AI-pipeline changes do not touch this repo unless the contract changes; each repo deploys independently.

---

## ADR-001: Nx over Turborepo

**Date:** 2026-03-04\
**Status:** accepted\
**Context:** The monorepo holds a frontend, a backend, and shared libraries; module-boundary enforcement is critical to stop them importing each other's internals.\
**Decision:** Use Nx for its built-in module-boundary lint rules, dependency-graph tooling, and framework generators.\
**Consequences:** Boundary violations are lint errors, not runtime failures; all task execution goes through Nx.
