# Architecture Decisions Log — Kebi

Log of architectural decisions. Add new entries at the top.

Format:

```
## ADR-NNN: Title
**Date:** YYYY-MM-DD\
**Status:** accepted | superseded | deprecated\
**Context:** Why this decision was needed.\
**Decision:** What we decided.\
**Consequences:** What follows from this decision.
```

---

## ADR-041: No dummy data — contract-first data flow

**Date:** 2026-05-31\
**Status:** accepted\
**Context:** The native client (`apps/mobile`) is built against an evolving kebi HTTP contract. Without a binding rule, the temptation is to stub or mock API responses in the frontend while backend fields are missing or unimplemented. This produces throwaway code that drifts from the live shape kebi and the gateway actually return, silently hides contract gaps, and means screens are never truly validated against the real system.\
**Decision:** No dummy, mock, placeholder, or stub data is permitted in `apps/mobile` (or any other frontend in this repo) for product flows. When a screen needs a field or endpoint that does not yet exist end-to-end, the implementation order is strictly: (1) add or update the endpoint/field in `docs/api-contract.md`, (2) add the corresponding type to `libs/shared`, (3) implement the change in `services/api` (gateway) and kebi — then build the frontend against the live response. Frontend work that would require fabricated data is parked until the contract and server provide it. Test fixtures inside `*.spec` and `*.test` files are exempt — unit and integration tests may use mock data for isolated assertions.\
**Consequences:** Screens may take longer to start because server-side contract work is a prerequisite. Every screen that ships is backed by a real, tested contract — no silent drift. This becomes a Constitution Check item: any plan proposing fixture or mock data for a product flow must be flagged and revised before implementation begins. The rule applies to all future features in `apps/mobile` and any revived `apps/web`.

---

## ADR-040: Park apps/web and libs/ui pending the native mobile rebuild

**Date:** 2026-05-29\
**Status:** accepted\
**Context:** The product is pivoting to a native React Native (Expo) app (`apps/mobile`) as the primary client; `apps/web` is frozen ("dead for now"). Per ADR-037, `apps/web` still renders the removed pre-`PlaceCore` surface and no longer compiles after `libs/shared` was stripped to the live contract types. Left in the Nx project graph, its broken typecheck blocks `lint`/`test`/`build` for the active projects (`shared`, `api`) during the cleanup and the mobile build.\
**Decision:** Park `apps/web` and `libs/ui` (the Radix/DOM design-system lib, consumed only by `apps/web`) by listing them in `.nxignore`, removing them from the Nx graph. The code stays in-tree as a reference implementation; nothing imports either project, so `shared` and `api` are unaffected. `libs/shared` simultaneously dropped its dead pre-`PlaceCore` type generation and now carries only live contract types. Web is **not** deleted — it is removed once `apps/mobile` reaches parity, or revived if the pivot reverses. Un-park by deleting the relevant line in `.nxignore`.\
**Consequences:** `apps/web` + `libs/ui` are intentionally non-compiling and excluded from CI/lint/test/build. The go-forward client is `apps/mobile` (Expo managed, Clerk via `@clerk/clerk-expo`, NativeWind, primitives in a new `libs/ui-native`); the design system in `docs/kebi-app-design-system` already targets the Expo build. Build sequence tracked in `docs/plans/2026-05-29-mobile-rn.md`.

---

## ADR-037: Gateway speaks the hardened kebi contract; movement_profile rides the token

**Date:** 2026-05-29\
**Status:** accepted\
**Context:** kebi hardened its HTTP contract: every protected route now requires service-to-service auth headers (`X-Gateway-Token` shared secret + `X-Gateway-User-Id`, the verified Clerk subject), `user_id` is no longer a body field, extraction is a synchronous `POST /v1/extract`, `POST /v1/signal` narrowed to recommendation accept/reject keyed by `place_core_id`, `DELETE /v1/user/data` dropped its user-id path segment, and the onboarding/tier surface (`GET /v1/user/context`, the `signal_tier` chat hint, the `chip_confirm` signal) was removed. The gateway was still on the pre-hardening contract and could not authenticate to kebi at all — every call would 401. Separately, `movement_profile` (a user mobility setting kebi consumes per chat turn) needed a home; it should be carried like the existing `plan`, which is a Clerk `publicMetadata` token claim.\
**Decision:** Align `services/api` with the current kebi contract. `AiServiceClient` attaches the gateway-auth headers on every protected call (fail-closed when `GATEWAY_SHARED_SECRET` is unset; it must match kebi byte-for-byte) and takes the verified `userId` per call instead of embedding it in bodies. Add `POST /api/v1/extract`. Reshape signal to accept/reject + `place_core_id`. Point delete at `/v1/user/data`. Remove `GET /api/v1/user/context`, `signal_tier`, and `chip_confirm` entirely. `movement_profile` becomes a Clerk `publicMetadata` claim extracted by `ClerkMiddleware` into `req.user` (exactly like `plan`); the gateway injects it into the kebi-bound chat body — the client never sends it. `plan` stays gateway-local (rate limits) and is not forwarded to kebi. Contract types (`MovementProfile`, `PlaceCore` plus the full category/tag taxonomy mirroring kebi, `ExtractPlaceResponse`, the narrowed signal types) live in `libs/shared` so the Next.js web client and the forthcoming React Native client share one source of truth.\
**Consequences:** Gateway auth is a coordinated cross-repo change — `GATEWAY_SHARED_SECRET` must be set identically on both kebi and the gateway and rotated together, and the hardened endpoints must deploy in lockstep with the kebi schema. `apps/web` consumers of the removed surface (`user/context`, `signal_tier`, `chip_confirm`) and the old `PlaceObject` rendering shape will not compile/run until a follow-up migrates them to `PlaceCore` — accepted and tracked separately. A user-facing write path to set `movement_profile` in Clerk metadata (a settings flow) is still owed; until then the field is absent and kebi applies its neutral fallback. The place category/tag unions in `libs/shared` mirror kebi's enums and must be kept in sync as that taxonomy evolves.

---

## ADR-036: Single POST /v1/chat endpoint replaces three-endpoint AI contract

**Date:** 2026-04-09\
**Status:** accepted\
**Context:** NestJS previously forwarded requests to three separate AI endpoints: POST /v1/extract-place (10s timeout), POST /v1/consult (20s timeout), and POST /v1/recall (20s timeout). This required NestJS to know the user's intent before forwarding — routing logic that belongs in the AI service, not the gateway. Additionally, NestJS was storing recommendation history after each consult request, coupling the gateway to AI response shapes.\
**Decision:** Replace all three AI endpoint methods on IAiServiceClient with a single chat(payload: ChatRequestDto): Promise<ChatResponseDto> method. The concrete implementation calls POST /v1/chat with a 30-second timeout. The AI service classifies intent internally and returns a typed ChatResponseDto with a discriminated type field (extract-place | consult | recall | assistant | clarification | error). NestJS always returns HTTP 200 for chat responses — error classification is the frontend's responsibility via the type field. HTTP error codes (401, 403, 503) are reserved for transport failures only. NestJS no longer writes recommendation history. The RecommendationsModule is deleted. This supersedes the three-endpoint contract in ADR-016. Constitution §I, §V, and §VI are updated: NestJS no longer writes recommendations; the AI contract is one endpoint, not three.\
**Consequences:** The old extract-place, consult, and recall NestJS endpoints are removed. The frontend must call POST /api/v1/chat for all interactions. SSE streaming (consultStream) is removed in this change — it can be added as chatStream() in a future ADR when the frontend requires real-time reasoning steps. AiServiceClient is simplified to one method and one timeout.

---

## ADR-035: TypeORM as the ORM for services/api

**Date:** 2026-04-09\
**Status:** accepted\
**Context:** services/api manages exactly two domain tables — users and user_settings. A lightweight ORM is sufficient for a two-table gateway service.\
**Decision:** Use TypeORM in services/api. `TypeOrmModule.forRootAsync()` reads `DATABASE_URL` from env vars via `ConfigService`. `synchronize: true` — acceptable at this stage (small team, no production data at risk). `UserEntity` and `UserSettingsEntity` map to the `users` and `user_settings` tables; `@PrimaryColumn()` with `@BeforeInsert()` CUID generation. TypeORM with `synchronize: true` only touches registered entities — AI-owned tables (places, embeddings, taste_model, consult_logs, user_memories, interaction_log) are never registered and are fully owned by kebi's Alembic migrations.\
**Consequences:** Single-tool schema management on the NestJS side. If the team grows or production data accrues, replace `synchronize: true` with explicit TypeORM migrations via a future ADR.

---

## ADR-034: Chain of Responsibility for request validation (deferred)

**Date:** 2026-03-14\
**Status:** deferred\
**Context:** NestJS controllers currently use a global ValidationPipe (ADR-017) for request body validation. As domain-specific validation rules grow — for example, validating consult location bounds, checking user quota before forwarding to kebi, or enforcing place input constraints — a single pipe or service method will accumulate unrelated rules that are hard to test independently.\
**Decision:** Deferred. Apply the Chain of Responsibility pattern when any single validation path exceeds 3 independent rules. Each validator implements a validate(payload) -> ValidationResult interface and is chained at module startup. Until the threshold is reached, a single validation method per service is acceptable.\
**Consequences:** No implementation now. When the threshold is reached, refactor into a chain of validator classes. Each rule becomes independently testable. Adding a new rule means adding a new class, not editing existing ones.

---

## ADR-033: Interface abstraction for all swappable dependencies in the product repo

**Date:** 2026-03-14\
**Status:** accepted\
**Context:** The product repo depends on external systems: Clerk for auth, TypeORM for database access, Axios for HTTP calls to kebi, and any future integrations. ADR-030 establishes that interfaces are implemented via classes. This ADR extends that to require an interface abstraction for any dependency that meets one or more criteria: (1) has more than one possible implementation now or in the future, (2) is an external system that could be swapped for cost, performance, or availability reasons, (3) needs to be mockable in tests without hitting a real service. This mirrors ADR-039 in kebi and makes the rule consistent across both repos.\
**Decision:** Any dependency meeting the criteria above must be abstracted behind a TypeScript interface before a concrete class is written. Concrete implementations live in their domain module or in a shared provider if used across multiple modules. Controllers and services depend on the interface only, injected via NestJS Depends(). No concrete class is imported directly in business logic. Swapping any dependency requires a config change and a new implementation class, never a change to business logic. AiServiceClient (ADR-016) is the first example of this pattern applied correctly — it abstracts all kebi HTTP forwarding behind a typed interface.\
**Consequences:** Every new external dependency introduced must be evaluated against the three criteria before implementation begins. If it qualifies, an interface is defined first, then the concrete class. This rule is a Constitution Check item — any plan that introduces a concrete external dependency directly into a controller or service must be flagged and revised before implementation starts.

---

## ADR-032: Facade pattern enforced on NestJS controllers

**Date:** 2026-03-14\
**Status:** accepted\
**Context:** NestJS controllers are entry points into the domain layer. Without a constraint, controllers accumulate business logic, direct database calls, and inline HTTP forwarding to kebi when building quickly. This couples the HTTP layer to infrastructure and makes both harder to test.\
**Decision:** Controllers are facades. Each controller method makes exactly one service call and returns the result. No direct database calls, no direct AiServiceClient calls, no Redis, no business logic appear inside any controller file. All orchestration lives in the service layer. The one exception is request validation via pipes and guards, which are decorators and do not count as logic inside the method body.\
**Consequences:** Controller files stay under 50 lines. Infrastructure concerns are testable independently of HTTP routing. Violations of this rule must be flagged during Constitution Check in the Plan phase before implementation begins.

---

## ADR-031: Agent Skills Integration in Development Workflow

**Date:** 2026-03-12\
**Status:** accepted\
**Context:** The Kebi project uses Claude Code with 8 agent skills installed to enhance development efficiency. Without a documented integration strategy, skills may be underutilized or invoked at the wrong workflow stage, wasting tokens or missing optimization opportunities.\
**Decision:** Agent skills are scoped to specific workflow stages (from ADR-028) and invoked only when task context matches their domain. The mapping is:

| Workflow Step | Active Skills | Activation Trigger |
|---------------|---------------|-------------------|
| **Clarify** | `nestjs-expert`, `nextjs16-skills` | Architecture questions, design uncertainty |
| **Plan** | `composition-patterns` | Multi-file changes, architecture decisions |
| **Implement** | `web-design-guidelines`, `react-best-practices`, `clerk-auth`, `nestjs-expert` | Writing code for respective domains |
| **Verify** | _(built-in)_ | `pnpm nx affected -t test,lint` |
| **Complete** | `vercel-deploy-claimable`, `use-railway` | Deployment required |

**Skill Details:**

- `nestjs-expert` — NestJS patterns, module architecture, dependency injection, guard/middleware design
- `nextjs16-skills` — Next.js 16 features, server/client component patterns, data fetching, middleware
- `composition-patterns` — Component composition, architectural refactoring, multi-layer design decisions
- `web-design-guidelines` — UI/UX consistency, component design, accessibility, design systems
- `react-best-practices` — React patterns, performance optimization, hooks, state management
- `clerk-auth` — Clerk authentication integration with Next.js, SDK usage, session handling
- `vercel-deploy-claimable` — Vercel deployment workflows, environment setup, optimization
- `use-railway` — Railway infrastructure, service provisioning, environment variables, troubleshooting

**Invocation Rule:** A skill is invoked only if task context shows (1) the skill domain is directly relevant, AND (2) the workflow step matches the table above. Example: Implementing a NestJS guard uses `nestjs-expert` in the Implement phase; optimizing a React component uses `react-best-practices` in the Implement phase; designing a module structure uses `composition-patterns` in the Plan phase.

**Consequences:** Skills reduce implementation time and token cost by providing focused guidance. Skills are available in every session for this project (installed in `.claude/skills/`). Developers invoking Claude Code get domain-specific support without manual configuration. Token efficiency improves through targeted skill use instead of exploratory implementations.

---

## ADR-030: Interfaces implemented only via classes, never via factory functions

**Date:** 2026-03-11\
**Status:** accepted\
**Context:** When defining injectable abstractions (like HttpClient), there are two patterns: factory functions that return objects, or classes that implement the interface. Factory functions are lighter but obscure the shape of what's being created. Classes are more explicit and composable.\
**Decision:** All interfaces in the codebase are implemented via classes that explicitly implement the interface (e.g., `class FetchClient implements HttpClient`). Never use factory functions to return objects that satisfy an interface. This makes the type visible in code and enables constructor-based dependency injection.\
**Consequences:** Every transport is a class. Every service is a class. Dependency injection (both manual and framework-based like NestJS) works the same way everywhere. Code is more discoverable — developers see the concrete type, not a factory.

---

## ADR-029: Injected HTTP client transport for apps/web

**Date:** 2026-03-11\
**Status:** accepted\
**Context:** Fetch calls are written inline inside Server Components and Server Actions, making it hard to swap the HTTP client, reuse calls, or change the base URL in one place. Testing and future transport swaps (axios, GraphQL) require tight coupling to a specific implementation.\
**Decision:** Create an API client layer at `apps/web/src/api/` with an injectable `HttpClient` interface. Each transport (fetch, axios, GraphQL) implements this interface as a class (`FetchClient implements HttpClient`). Nothing outside `apps/web/src/api/` imports fetch, axios, or any HTTP library directly.

**Split reads and mutations.** Reads are plain async functions (queries) — no `'use server'` directive. Next.js caching works normally on them. Mutations have `'use server'` and are called from forms and Client Components via Server Actions. Both go through the same transport layer underneath.

Structure:

```
apps/web/src/api/
  types.ts              — HttpClient interface (get, post)
  transports/
    fetch.transport.ts  — FetchClient class implementing HttpClient
  server.ts             — getApiClient() using Clerk server SDK
  queries/
    places.query.ts     — plain async functions, no directive
  mutations/
    places.mutation.ts  — 'use server'
    consult.mutation.ts — 'use server'
  index.ts              — re-exports all queries and mutations
```

**The rule:** Reads are queries, mutations are Server Actions, both go through the same transport layer.

**Client-side hook for token management:** Client components need tokens from Clerk when calling the API. The `useApiClient()` hook in `apps/web/src/api/hooks.ts` wraps `createApiClient()` with Clerk's `useAuth().getToken()`:

```ts
// apps/web/src/api/hooks.ts
export function useApiClient() {
  const { getToken } = useAuth();
  return createApiClient(async () => {
    const token = await getToken();
    return token ?? '';
  });
}
```

Components never import HttpClient, FetchClient, createApiClient, or getApiClient directly. Usage:

```ts
// Server Component — read
import { getPlaces } from "@/api";
const places = await getPlaces();

// Client Component — use the hook
const api = useApiClient();
const result = await api.post('/consult', { query });

// Or use Server Actions (mutations)
import { extractPlace } from "@/api";
await extractPlace({ input });
```

**Instance lifecycle:** `getApiClient()` creates a fresh `FetchClient` on every call. This is fine because `FetchClient` is stateless — the constructor must stay cheap and do no I/O. If the constructor ever needs to do async work (e.g., connection pooling), refactor to a singleton pattern.

**Error handling:** `FetchClient` throws a typed `ApiError` (extending `Error`) with `status`, `statusText`, and parsed response body. API functions do not catch or normalise errors — they let the error propagate to the caller. Components handle errors via try/catch or React error boundaries. This keeps the API layer thin and gives components full control over error UX.

See `docs/examples/consult-example.ts` for the full flow.

**Consequences:** Swapping transports requires changing one class. Components stay thin — one function call, typed response. Reads benefit from Next.js caching. Mutations run as Server Actions. No DI library needed. Request/response types come from `@kebi-app/shared` when implemented.

---

## ADR-028: 5-Step Token-Efficient Workflow (Clarify → Plan → Implement → Verify → Complete)

**Date:** 2026-03-09\
**Status:** accepted\
**Context:** Previous workflow was unclear about when to use agents, causing token waste through unnecessary subagent dispatches and review loops. Needed a standardized approach that scales from simple 1-file tasks to complex multi-repo changes.\
**Decision:** Adopt 5-step workflow with specific Claude model per step: (1) **Clarify** (Haiku) — If ambiguous, ask 5 questions; (2) **Plan** (Sonnet) — If 3+ files, create docs/plans/\*.md with phases + Constitution Check against docs/decisions.md; (3) **Implement** (Haiku/Sonnet per complexity) — Follow plan checklist, write code, commit; (4) **Verify** (Haiku) — Run commands, all must pass; (5) **Complete** (Haiku) — Mark task done. See `.claude/workflows.md` for flow, `.claude/constitution.md` for check process.\
**Consequences:** Average task cost reduced from 250K to 13-18K tokens (~95% savings). Clear decision points on when to plan vs implement. Constitution Check catches architectural violations early (in Plan phase, not Implement phase). Plan doc becomes single source of truth for implementation. Workflow applies consistently across all repos (kebi-app, kebi, future repos).

---

## ADR-027: _(reserved — unused)_

---

## ADR-026: Database migration ownership split _(superseded by ADR-035)_

**Date:** 2026-03-09\
**Status:** superseded\
**Context:** Originally defined how two ORM tools would share one PostgreSQL instance.\
**Decision:** Superseded by ADR-035. Current state: NestJS uses TypeORM with `synchronize: true` for `users` and `user_settings`; Alembic in kebi owns all AI tables. See ADR-035 for details.

---

## ADR-025: Secrets in .env.local, non-secrets in config/app.yaml (NestJS); .env.local for Next.js; config/.local.yaml for FastAPI

**Date:** 2026-03-09\
**Status:** accepted\
**Context:** Secrets must never be stored in version control. Each service needs a simple way to manage its own secrets without external dependencies or complex setup.\
**Decision:** (1) **NestJS** (kebi-app/services/api) — secrets in `.env.local` (gitignored, symlinked to `kebi-config/secrets/api.env.local`); non-secrets in `services/api/config/app.yaml` (committed). `ConfigModule` loads `.env.local` via `envFilePath` for local dev; Railway injects the same variable names as env vars in production. (2) **Next.js** (kebi-app/apps/web) — secrets in `.env.local` (gitignored). (3) **FastAPI** (kebi) — secrets in `config/.local.yaml` (gitignored). Secret files are never committed.\
**Consequences:** Non-secret NestJS config (`app.yaml`) is version-controlled and reviewable. Secrets are isolated in gitignored files symlinked from `kebi-config/secrets/`. Railway variable names are the canonical names — `.env.local` keys must match them exactly for local/prod parity.

---

## ADR-024: Zustand for client-side UI state

**Date:** 2026-03-08\
**Status:** accepted\
**Context:** The Next.js frontend needs minimal global client state — query input, active recommendation, modal visibility. Most data fetching is handled by TanStack Query (server state) or Next.js server components. A full state management solution like Redux would be overkill.\
**Decision:** Use Zustand for client-side UI state in `apps/web`. TanStack Query handles all async server state (API calls, caching, mutation lifecycle). Zustand handles lightweight UI state that must be shared across components (current query string, active recommendation result, drawer/modal open state). Auth state is owned by Clerk. Locale and i18n routing is owned by `next-intl`. Theme is owned by `next-themes`. Zustand does not replace any of these.\
**Consequences:** Client bundle stays lean (~1KB for Zustand). No Redux boilerplate. Store is defined once in `apps/web/src/store/` and consumed via hooks. If a piece of state is only needed in one component, it stays local with `useState` — Zustand is only for cross-component shared state.

---

## ADR-023: @Serialize() decorator for controller response shaping

**Date:** 2026-03-08\
**Status:** accepted\
**Context:** Controllers returning raw TypeORM entity objects or AI response objects would expose internal fields and couple the response shape to the persistence layer. A consistent serialization mechanism is needed across all controllers.\
**Decision:** A custom `@Serialize(DtoClass)` decorator applies an interceptor that calls `plainToInstance(DtoClass, data, { excludeExtraneousValues: true })` on every response. All controller methods that return data use `@Serialize(ResponseDto)`. Response DTOs use `@Expose()` on fields that should be included. Raw entity objects and AI response objects are never returned directly.\
**Consequences:** Response shape is decoupled from persistence layer. Adding or removing a response field requires only updating the DTO. Controllers stay clean — no manual mapping logic.

---

## ADR-022: AiEnabledGuard with per-user flag and global kill switch

**Date:** 2026-03-08\
**Status:** accepted\
**Context:** AI requests to kebi are expensive and may need to be disabled — either globally (service outage, cost control) or per-user (abuse, account restriction). This must be enforced at the NestJS boundary before any forwarding happens.\
**Decision:** `AiEnabledGuard` in `services/api/src/common/guards/ai-enabled.guard.ts` runs after `ClerkMiddleware` on AI routes only. It checks two things in order: (1) `AI_GLOBAL_KILL_SWITCH` Railway environment variable — if set to the string `"true"`, blocks all AI requests with 503, no redeploy needed; (2) `req.user.ai_enabled` from the verified Clerk JWT — if false, blocks that user's AI requests with 403, defaults to true if the field is absent. Applied via the `@RequiresAi()` decorator (shorthand for `@UseGuards(AiEnabledGuard)`) on endpoints that call the AI service. New users get `ai_enabled: true` and `plan: "homebody"` set in Clerk `publicMetadata` via the `user.created` webhook handler.\
**Consequences:** AI can be killed globally by setting `AI_GLOBAL_KILL_SWITCH=true` in Railway without a redeploy. Individual users can be disabled via Clerk dashboard or API without touching the codebase. The `@RequiresAi()` decorator provides a clean, reusable pattern for guard application across multiple endpoints. Guard order matters — `ClerkMiddleware` must run first to populate `req.user`.

---

## ADR-021: Bruno over Swagger for API documentation

**Date:** 2026-03-08\
**Status:** accepted\
**Context:** The NestJS API needs a way to document and test endpoints. Swagger (`@nestjs/swagger`) would duplicate the contract already maintained in `docs/api-contract.md` and add runtime overhead.\
**Decision:** No Swagger. Bruno is the API testing and documentation tool. Every new NestJS endpoint gets a corresponding `.bru` request file in `kebi-config/bruno/`. `docs/api-contract.md` remains the human-readable source of truth for the NestJS ↔ kebi contract.\
**Consequences:** No `@ApiProperty()` decorators in DTOs. No Swagger UI endpoint. New endpoints require a `.bru` file — this is the acceptance signal that an endpoint is documented and testable.

---

## ADR-020: pnpm as the package manager (supersedes ADR-006)

**Date:** 2026-03-07\
**Status:** accepted\
**Context:** The repo was initially set up with Yarn (ADR-006). Yarn was migrated away from in commit `eadf081` ("chore: migrate from yarn to pnpm"). pnpm has stricter dependency isolation, faster installs via a content-addressable store, and good Nx monorepo support with workspace protocol. CLAUDE.md and all dev commands already reference pnpm.\
**Decision:** pnpm is the package manager for the entire monorepo. All installs use `pnpm install`. Workspace packages reference each other via `workspace:*`. All scripts in CLAUDE.md and CI use `pnpm nx …`. No `yarn.lock` or `package-lock.json` is committed — only `pnpm-lock.yaml`.\
**Consequences:** Developers must have pnpm installed (`npm i -g pnpm`). Phantom dependency bugs are caught earlier due to pnpm's strict hoisting. ADR-006 is superseded and its Yarn-specific guidance no longer applies.

---

## ADR-019: Forward-compatible DTOs for AI service responses

**Date:** 2026-03-07\
**Status:** accepted\
**Context:** The api-contract.md explicitly states that the kebi response schema will evolve and clients must not fail on extra keys. DTOs that strip or reject unknown fields would break silently when kebi adds new fields.\
**Decision:** AI service response DTOs in `services/api/src/ai-service/dto/` declare all currently known fields and mark every field optional with `@IsOptional()`. Unknown fields from the AI response are not stripped at the NestJS boundary — they pass through to the frontend or are ignored. Implementation is pending.\
**Consequences:** NestJS tolerates kebi API evolution without breaking. Frontend receives richer payloads as new fields are added. DTOs must be updated when new fields become required by business logic.

---

## ADR-018: Global exception filter mapping AI service errors to frontend responses

**Date:** 2026-03-07\
**Status:** accepted\
**Context:** kebi returns 400, 422, 500, and timeout conditions that require different user-facing messages. Without a consistent translation layer, error handling would be duplicated across every controller.\
**Decision:** A global `AllExceptionsFilter` registered in `services/api/src/main.ts` catches Axios errors from AI service calls and HTTP exceptions from NestJS itself. It maps AI service 400 → 400, 422 → 422 with "couldn't understand" message, 500 → 503 with retry suggestion, and timeout → 503. The filter lives in `services/api/src/common/filters/all-exceptions.filter.ts`. Implementation is pending.\
**Consequences:** All controllers get consistent error translation for free. AI service error shape changes require only updating this filter, not each controller. No raw Axios errors reach the frontend.

---

## ADR-017: Global ValidationPipe with whitelist mode

**Date:** 2026-03-07\
**Status:** accepted\
**Context:** Without a global validation pipe, invalid request bodies would reach controllers and services, causing hard-to-debug runtime errors. Without whitelist mode, extra fields sent by clients could leak into service logic.\
**Decision:** `ValidationPipe` is registered globally in `services/api/src/main.ts` with `{ whitelist: true, forbidNonWhitelisted: true, transform: true }`. All request DTOs in `services/api/src/<domain>/dto/` use `class-validator` decorators. Implementation is pending.\
**Consequences:** Invalid requests are rejected at the pipe before reaching controllers. DTOs are the authoritative contract for incoming data. `transform: true` means the parsed class instance (not plain object) reaches controllers, enabling typed access.

---

## ADR-016: AiServiceClient encapsulating all forwarding to kebi _(superseded by ADR-036)_

**Date:** 2026-03-07\
**Status:** superseded\
**Context:** Both the places and recommendations domains need to call kebi. Without a shared abstraction, each service would duplicate base URL config, timeout setup, and error normalization.\
**Decision:** `AiServiceModule` in `services/api/src/ai-service/` wraps NestJS `HttpModule` (Axios). `AiServiceClient` (injectable service) exposes two typed methods: `extractPlace(payload)` → calls `POST /v1/extract-place` and `consult(payload)` → calls `POST /v1/consult`. Base URL is read from `ConfigService` (`ai_service.base_url`). Timeouts are set per endpoint: 10s for extract-place, 20s for consult. Implementation is pending.\
**Consequences:** All AI forwarding is in one place. Domain services call `AiServiceClient` methods rather than raw HTTP. Timeout policy from api-contract.md is enforced consistently. Future auth header between services (shared secret) is added once in this module.

---

## ADR-015: Global singleton DB provider _(superseded by ADR-035)_

**Date:** 2026-03-07\
**Status:** superseded\
**Context:** Originally specified the shape of a global DB service provider.\
**Decision:** Superseded by ADR-035. `TypeOrmModule.forRootAsync()` now provides the global DataSource; domain services inject repositories via `@InjectRepository()`.

---

## ADR-014: One NestJS module per domain bounded context

**Date:** 2026-03-07\
**Status:** accepted\
**Context:** NestJS applications that grow without module boundaries become coupled monoliths where any service can call any other. The architecture limits NestJS to three concerns: users, recommendations, and AI forwarding. Each needs clear isolation.\
**Decision:** Domain modules are: `UsersModule` (`services/api/src/users/`), `RecommendationsModule` (`services/api/src/recommendations/`), and `AiServiceModule` (`services/api/src/ai-service/`). Each module contains its own controller, service, and `dto/` subdirectory. `AppModule` imports all domain modules. No cross-domain service injection — domains communicate only through `AiServiceClient`. Implementation is pending.\
**Consequences:** Adding a new domain (e.g., feedback) requires creating one new module folder. Controller and service responsibilities stay narrow. DTO types are local to their domain unless promoted to `libs/shared`.

---

## ADR-013: Clerk auth middleware applied globally with public path opt-out

**Date:** 2026-03-07\
**Status:** accepted\
**Context:** Every authenticated endpoint needs Clerk token verification. Applying checks per-controller would be error-prone — a missed guard means an unprotected endpoint. A global check with opt-out is safer. Auth must be enforced at both the Next.js edge (for page protection) and the NestJS API (for endpoint protection).\
**Decision:** Two complementary layers:

1. **Frontend (Next.js edge):** `clerkMiddleware()` from `@clerk/nextjs/server` in `apps/web/src/middleware.ts` protects all routes except those matched by `createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])`. Unauthenticated requests are redirected to sign-in at the edge (before the app loads).

2. **Backend (NestJS):** `ClerkMiddleware` in `services/api/src/common/middleware/clerk.middleware.ts` verifies bearer tokens from the `Authorization` header using the `@clerk/backend` SDK. Routes matching `auth.public_paths` from config (e.g., `/health`, `/webhooks/clerk`) skip verification. The verified user context (`userId`, `ai_enabled`) is attached to `req.user` for downstream use. A `@Public()` decorator marks routes as documentation; the middleware uses config, not decorators, to determine public access.

**Consequences:** All pages are protected at the edge — no unprotected pages. All API endpoints are authenticated by default. Public endpoints are explicitly listed in config, not marked with decorators. `req.user` is available in all NestJS controllers without re-verifying downstream. Clerk tokens are automatically handled by middleware, not repeated in every handler. Config is the single source of truth for public routes.

---

## ADR-012: YAML ConfigModule for non-secret configuration

**Date:** 2026-03-07\
**Status:** accepted\
**Context:** NestJS needs access to non-secret config values like `ai_service.base_url`. Using environment variables for non-secrets defeats the purpose of YAML config (ADR-003). Without a structured loader, config access would be ad-hoc string lookups.\
**Decision:** NestJS `ConfigModule` is registered as global in `AppModule` with a custom YAML loader that reads the appropriate `config/<environment>.yml` file based on `NODE_ENV`. `ConfigService` is injected wherever config values are needed. Non-secret keys follow dot-notation paths (e.g., `ai_service.base_url`). Implementation is pending.\
**Consequences:** All non-secret config is version-controlled and environment-specific. Services access config via typed `ConfigService.get<T>()` calls. Adding a new config key requires only updating `config/*.yml` — no code changes needed for the loader.

---

## ADR-011: Bootstrap PORT env-var guard with explicit error

**Date:** 2026-03-07\
**Status:** accepted\
**Context:** If `PORT` is not set (e.g., `.env.local` is missing or incomplete), the NestJS app would start on an undefined port and fail silently or bind to `NaN`. Developers would see a confusing error rather than a clear fix instruction.\
**Decision:** `services/api/src/main.ts` checks `process.env.PORT` after calling `NestFactory.create()`. If absent, it throws `new Error('PORT environment variable is not set. Create a .env.local file and populate it with your secrets.')` before calling `app.listen()`. This is already implemented in `bootstrap()` in `services/api/src/main.ts`.\
**Consequences:** Misconfigured environments fail fast with a clear fix instruction. No silent startup on port `undefined`. Pattern established for future required env-var guards at bootstrap.

---

## ADR-010: Global API prefix driven by shared constant

**Date:** 2026-03-07\
**Status:** accepted\
**Context:** The `/api/v1/` prefix must be consistent across NestJS routing and any TypeScript code that builds URLs to call the NestJS API (e.g., the frontend fetch client). Hardcoding it in `main.ts` alone would create drift if it ever changes.\
**Decision:** `API_GLOBAL_PREFIX = 'api/v1'` is defined in `libs/shared/src/lib/constants.ts` and exported from `libs/shared/src/index.ts`. `services/api/src/main.ts` calls `app.setGlobalPrefix(API_GLOBAL_PREFIX)` using this constant. The frontend fetch client will import the same constant via `@kebi-app/shared` when implemented. This is already implemented.\
**Consequences:** The prefix is defined once and consumed wherever needed. A prefix change requires editing one constant. Nx boundary rules ensure `apps/web` can import `@kebi-app/shared` where this constant lives.

---

## ADR-009: SSE streaming as future consult response mode _(superseded by ADR-036)_

**Date:** 2026-03-05\
**Status:** superseded\
**Context:** The consult endpoint returns reasoning_steps in a synchronous JSON response. When the frontend needs to show agent thinking in real time, the API contract would need redesigning mid-build without a plan.\
**Decision:** Document SSE as a future response mode now. When needed, FastAPI streams reasoning steps as they complete, NestJS proxies the SSE stream to the frontend. The synchronous mode remains the default. No implementation until the frontend requires it.\
**Consequences:** API contract is forward-compatible. No work needed today. When SSE is implemented, NestJS must proxy the stream and the frontend must handle incremental rendering.

---

## ADR-008: reasoning_steps in consult response

**Date:** 2026-03-05\
**Status:** accepted\
**Context:** When a bad recommendation comes back, there is no way to tell if intent parsing failed, retrieval missed the right place, or ranking scored incorrectly. The eval pipeline also needs per-step accuracy measurement.\
**Decision:** The consult response includes a `reasoning_steps` array. Each entry has a `step` identifier and a human-readable `summary` of what happened at that stage. kebi produces it, this repo consumes and renders it.\
**Consequences:** Frontend can display agent thinking steps. DTOs must include the new field. Both repos' API contract docs updated.

---

## ADR-007: Tailwind v3 + shadcn/ui over Tailwind v4

**Date:** 2026-03-04\
**Status:** accepted\
**Context:** The UI needs a component library with Dialog, Sheet, Toast, Skeleton, and Command — all required for Kebi's core UX. Tailwind v4 was available but shadcn/ui was not fully stable on it at project start.\
**Decision:** Use Tailwind CSS v3 with shadcn/ui. shadcn components are copied into `libs/ui` (not installed as a package) so the code is owned and can be modified freely. Alternatives considered: Tailwind v4, Radix primitives without shadcn, Material UI.\
**Consequences:** shadcn components are fully customisable with no upstream dependency. Tailwind v3 patterns apply throughout — see `.claude/rules/tailwind-patterns.md`. If upgrading to Tailwind v4 in future, shadcn components will need re-testing.

---

## ADR-006: Yarn over npm/pnpm _(superseded by ADR-020)_

**Date:** 2026-03-04\
**Status:** superseded\
**Context:** A package manager was needed for the Nx monorepo at project creation. Yarn with `nodeLinker: node-modules` was chosen to avoid PnP compatibility issues.\
**Decision:** Use Yarn with `nodeLinker: node-modules`. Alternatives considered: pnpm, npm.\
**Consequences:** Superseded by ADR-020. The repo has since migrated to pnpm.

---

## ADR-005: Initial ORM choice _(superseded by ADR-035)_

**Date:** 2026-03-04\
**Status:** superseded\
**Context:** Initial ORM decision for services/api.\
**Decision:** Superseded by ADR-035. Current ORM: TypeORM.

---

## ADR-004: Clerk over custom auth

**Date:** 2026-03-04\
**Status:** accepted\
**Context:** Implementing auth from scratch (JWT issuance, refresh tokens, session management) would consume weeks of development time better spent on AI features.\
**Decision:** Use Clerk for authentication across both Next.js and NestJS. Clerk's free tier covers 50K MAU and provides SDKs for both runtimes. Alternatives considered: NextAuth/Auth.js, Supabase Auth, custom JWT.\
**Consequences:** Auth is fully delegated to Clerk. No custom session logic exists in this repo. The `userId` from Clerk is the canonical user identifier throughout the system.

---

## ADR-003: YAML config over dotenv for non-secrets

**Date:** 2026-03-04\
**Status:** accepted\
**Context:** Non-secret config values like `ai_service.base_url` need structure and environment-specificity that flat `.env` files cannot provide cleanly.\
**Decision:** Use YAML files (`config/dev.yml`, `config/prod.yml`) for all non-secret configuration. Secrets are stored in per-repo local files (`.env.local` for NestJS/Next.js, `config/.local.yaml` for FastAPI), gitignored and created locally by developers. No committed `.env` or secret files. Alternatives considered: dotenv for everything, JSON config files, environment variable-based secrets.\
**Consequences:** Config is version-controlled and structured. Secrets never appear in config files. Adding a new non-secret value requires only a YAML edit, not a code change.

---

## ADR-002: Separate AI repo (kebi)

**Date:** 2026-03-04\
**Status:** accepted\
**Context:** All AI/ML logic requires Python, a different deployment target (Python runtime with GPU), and a faster iteration cycle than product code. Mixing languages in one repo would complicate CI, deployments, and dependency management.\
**Decision:** Keep all AI/ML code in a separate Python repository (`kebi`). This repo communicates with it via HTTP only. Alternatives considered: Python in a monorepo subfolder, AI logic as a microservice within this repo.\
**Consequences:** A stable HTTP contract (see `docs/api-contract.md`) is the boundary between repos. Changes to the AI pipeline do not require touching this repo unless the contract changes. Each repo deploys independently.

---

## ADR-001: Nx over Turborepo

**Date:** 2026-03-04\
**Status:** accepted\
**Context:** The monorepo contains a Next.js frontend, NestJS backend, and shared libraries. Module boundary enforcement is critical to prevent `apps/web` from importing backend code and vice versa.\
**Decision:** Use Nx as the monorepo tool. Nx provides built-in module boundary lint rules, dependency graph visualisation, and first-class generators for both Next.js and NestJS. Alternatives considered: Turborepo, plain Yarn workspaces.\
**Consequences:** Module boundaries are enforced by Nx ESLint rules. Violating a boundary produces a lint error, not a runtime failure. All task execution (build, test, lint) goes through `pnpm nx`.
