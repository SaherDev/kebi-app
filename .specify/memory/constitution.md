# Kebi Constitution

## I. Two-Repo Boundary (NON-NEGOTIABLE)

NestJS is a thin gateway. The AI IS the product. Everything in this repo serves auth, forwarding, product data storage, and CRUD — nothing else.

NestJS has exactly four responsibilities:

1. Authenticate every request (Clerk)
2. Forward AI requests to kebi with user context
3. Write product data to PostgreSQL (users, user_settings) via TypeORM
4. Serve user CRUD

NestJS NEVER: calls LLMs, generates embeddings, runs vector search, calls Google Places API, writes place/embedding/taste_model records, or touches Redis. If a task requires any of these, it belongs in kebi.

## II. Nx Module Boundaries (NON-NEGOTIABLE)

| Source         | Can import               | Cannot import              |
| -------------- | ------------------------ | -------------------------- |
| `apps/web`     | `libs/shared`, `libs/ui` | `services/api`             |
| `services/api` | `libs/shared`            | `apps/web`, `libs/ui`      |
| `libs/ui`      | `libs/shared`            | `apps/web`, `services/api` |
| `libs/shared`  | nothing                  | everything                 |

Cross-boundary imports are lint errors. Never suppress them — move the code to the right lib.

## III. Architecture Decisions Are Constraints

All ADRs in `docs/decisions.md` are accepted constraints, not suggestions. Before proposing any technical approach, check decisions.md. A new approach that contradicts an existing ADR requires a new superseding ADR first.

Current binding decisions:

- **ADR-001**: Nx (not Turborepo)
- **ADR-003**: YAML config for non-secrets, shell env vars for secrets, no `.env` files
- **ADR-004**: Clerk for auth everywhere
- **ADR-035**: TypeORM as the ORM for services/api (supersedes ADR-005)
- **ADR-007**: Tailwind v3 + shadcn/ui (not v4)
- **ADR-010**: `/api/v1/` global prefix via constant in `libs/shared`
- **ADR-012**: YAML ConfigModule, `ConfigService` for all config access
- **ADR-013**: `ClerkAuthGuard` global + `@Public()` opt-out
- **ADR-014**: One NestJS module per domain
- **ADR-035**: TypeORM with `synchronize: true`, two entities (users, user_settings)
- **ADR-016**: `AiServiceClient` for all forwarding to kebi
- **ADR-017**: Global `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true, transform: true`
- **ADR-018**: Global `AllExceptionsFilter` for AI service error mapping
- **ADR-020**: pnpm as package manager
- **ADR-021**: Bruno for API testing — no Swagger, no `@ApiProperty()`
- **ADR-022**: `AiEnabledGuard` for per-user and global AI kill switch
- **ADR-023**: `@Serialize(DtoClass)` decorator for all controller responses

## IV. Configuration Rules

- Non-secret config → `services/api/config/app.yaml` (NestJS), `apps/web/next.config.js` (Next.js)
- Secrets → `.env.local` in each service (gitignored, symlinked from `kebi-config/secrets/`). FastAPI uses `config/.local.yaml`
- No `.env` or secret files committed — developers create these locally with their own secret values
- Constants shared across apps → `libs/shared/src/lib/constants.ts`
- Nothing hardcoded: URLs, ports, thresholds, labels must come from config or a named constant

## V. Database Write Ownership

- NestJS writes: `users`, `user_settings` (via TypeORM with `synchronize: true`)
- FastAPI writes: `places`, `embeddings`, `taste_model`, `consult_logs`, `user_memories`, `interaction_log`
- Alembic in kebi owns all AI-table migrations
- pgvector columns are owned entirely by kebi's Alembic migrations — NestJS never defines vector columns

## VI. AI Service Contract

Single endpoint (ADR-036), via `AiServiceClient`:

- `POST /v1/chat` — 30s timeout; kebi classifies intent and returns a discriminated `ChatResponseDto`.

Base URL: `AI_SERVICE_BASE_URL` env var (`.env.local` locally, Railway variable in production).
Full schema in `docs/api-contract.md`. Response DTOs must tolerate extra fields (forward-compatible, `@IsOptional()` on all AI response fields).

## VII. Frontend Standards

- Tailwind v3 — semantic tokens only (`bg-primary`, not `bg-purple-600`)
- RTL logical properties only: `ms/me/ps/pe/start/end` — never `ml/mr/pl/pr/left/right`
- i18n via `next-intl` — no hardcoded user-facing strings in components
- Dark mode via `next-themes` + CSS variables in `globals.css`
- Shared UI components in `libs/ui` using `cva` + `cn()`

## VIII. Code Standards

- Files: `kebab-case.ts` | Classes: `PascalCase` | DTOs: `PascalCase` + `Dto` suffix
- Shared types in `libs/shared` — never duplicate between apps
- No barrel exports from apps — only `libs/shared` has a public `index.ts`
- No inline ESLint disables without a comment explaining why

## IX. Git & Commits

- Comment char is `;` not `#` (`git config core.commentChar ";"`)
- Format: `type(scope): description #TASK_ID`
- Types: `feat|fix|chore|docs|refactor|test` | Scopes: `api|web|shared`
- Feature branches from `dev`, merge to `dev`, milestone merges to `main`
- Never push directly to `main`
- New endpoints require a `.bru` file in `kebi-config/bruno/`

## X. Required Skills Per Domain

Before planning or implementing in any domain, invoke the matching skill via the Skill tool. This applies at every speckit step (plan, tasks, implement).

| Domain | Skill to invoke | When |
| --- | --- | --- |
| `services/api` (NestJS) | `nestjs-expert` | Any backend module, controller, service, guard, DI |
| `apps/web` (Next.js) | `nextjs16-skills` | Server/client components, routing, data fetching |
| `apps/web` (React) | `vercel-react-best-practices` | Hooks, state, performance, React patterns |
| Auth (Clerk) | `clerk-nextjs-skills` | Protected routes, session, Clerk SDK usage |
| UI/UX | `web-design-guidelines` | Component design, accessibility, design systems |
| Architecture | `vercel-composition-patterns` | Multi-layer design, composition, refactoring |
| Deployment | `deploy-to-vercel` | Vercel workflows, env setup, optimization |

For cross-domain tasks (e.g., NestJS + auth), invoke all relevant skills before starting.

## Governance

This constitution supersedes ad-hoc decisions. New architectural choices require an ADR entry in `docs/decisions.md` before implementation. The constitution is updated when new ADRs are added.

**Version**: 1.1 | **Ratified**: 2026-03-17
