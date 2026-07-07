# CLAUDE.md — Kebi Product Repo

**Rule: Keep this file under 150 lines. Move detailed standards to `.claude/rules/` files and reference them here.**

## Project Context

Kebi is an AI-native place decision engine. The AI IS the product — NestJS is supporting infrastructure. Users share places over time (free-text, URLs, descriptions), the system builds a taste model, and returns one confident recommendation from natural language intent. This is the **product repo**: an Nx monorepo with a Next.js frontend (`apps/web`), NestJS backend (`services/api`), and shared TypeScript types (`libs/shared`). NestJS is a **thin gateway** — it authenticates, forwards AI requests, stores recommendation history, and serves user CRUD. All AI logic lives in a separate Python repo (`kebi`, FastAPI) that acts as the **autonomous AI brain**. See @docs/architecture.md for the full design and `docs/api-contract.md` for the HTTP contract.

## Key Directories

```
apps/web/          → Next.js frontend (Tailwind v3, shadcn/ui, Clerk auth)
services/api/      → NestJS backend (auth gateway, no DB writes)
libs/shared/       → Shared TypeScript types, DTOs, constants
libs/ui/           → Design system (shadcn/ui components, cva variants, cn() utility)
apps/web/messages/ → i18n translation files (en.json)
config/            → YAML configuration files (dev.yml, prod.yml, test.yml)
scripts/           → Shell scripts (utilities)
docs/              → Operational docs (architecture, API contract, decisions)
.claude/rules/     → Claude Code rules (git, architecture, frontend, standards)
```

## Common Commands

```bash
# Mobile (iOS simulator — Expo Go, no native build needed)
pnpm nx run mobile:start       # Metro bundler → press i for iOS simulator
pnpm nx run mobile:run-ios     # boot directly in iOS simulator

# Backend
pnpm nx serve api              # NestJS on http://localhost:3333/api/v1

# Testing
pnpm nx test mobile            # Mobile tests (jest-expo)
pnpm nx test api               # Backend tests (Jest)
pnpm nx run-many -t test       # All tests

# Lint & Build
pnpm nx run-many -t lint
pnpm nx build api



# Deployment: Vercel (frontend), Railway (backend + AI + PostgreSQL + Redis)
```

## Standards

Details in @.claude/rules/standards.md, @.claude/rules/architecture.md, @.claude/rules/frontend.md, and @.claude/rules/tailwind-patterns.md.

- **Zero hardcoding** — config (YAML/env vars) or constants in `libs/shared` for everything
- **Path aliases** — `@kebi-app/shared`, `@kebi-app/ui`; app-internal imports use relative paths
- **Naming** — files: `kebab-case.ts`, classes: `PascalCase`, DTOs: `PascalCase` + `Dto` suffix
- **Types** — shared types in `libs/shared`, no type duplication; Zod schemas in `apps/web` for runtime validation of AI responses
- **Linting** — Nx-generated ESLint configs only, no plugins, no inline disables without comments
- **Nx boundaries** — `apps/web` imports `libs/shared` + `libs/ui`; `services/api` imports `libs/shared` only; `libs/shared` imports nothing
- **Architecture** — NestJS: authenticate, forward all user messages to kebi via `POST /v1/chat`, return the response — nothing else. NestJS has no database writes. FastAPI owns all DB writes (places, embeddings, taste_model, consult_logs, user_memories, interaction_log) via Alembic migrations
- **Frontend** — Tailwind v3 + shadcn/ui, CSS variables with raw HSL, dark mode via `next-themes`, i18n via `next-intl` with URL routing `/en/`
- **API routes** — all NestJS routes use `/api/v1/` prefix; AI service called via single endpoint (`POST /v1/chat`); frontend calls `POST /api/v1/chat` for all interactions (ADR-036)
- **Commits** — `type(scope): description`, types: `feat|fix|chore|docs|refactor|test`, scopes: `api|web|shared` (details in @.claude/rules/git.md)
- **Code quality** — single responsibility, constructor injection only, strategy pattern over if/switch on type, repository pattern for all DB access, no duplication (extract to `libs/shared`), new behavior = new class not an edit. Violations must be fixed before presenting code.

## Workflow

See `.claude/workflows.md` for the complete 5-step token-efficient workflow (ADR-028):

1. **Clarify** — If ambiguous (3+ unknowns), ask 5 questions. Record answers in chat.
2. **Plan** — If 3+ files or crosses repo boundary, create `docs/plans/YYYY-MM-DD-<feature>.md` with phases and checklist.
3. **Implement** — Follow plan checklist, write code, commit per `.claude/rules/git.md`.
4. **Verify** — Run verify commands from plan (`pnpm nx affected -t test,lint`), all must pass.
5. **Complete** — Mark task done. Update task status only.

**IMPORTANT: Read `docs/decisions.md` FIRST — before planning, before implementing, before any architectural discussion.** Every ADR is a binding constraint. If your approach contradicts a decision, stop and flag it. This is the first thing you do, not a later verification step.

**Constitution Check:** Verify plan aligns with `docs/decisions.md` (see `.claude/constitution.md`).

**Agent Skills Integration:** Skills (see ADR-031) auto-trigger based on code domain and workflow stage, not user prompt keywords. All skills follow the same principles as the codebase — if skill guidance conflicts with project standards (CLAUDE.md, architecture.md, ADR-\*), project standards take precedence. Skills are guides, not constraints.

**Model assignments and token costs:** See `.claude/workflows.md` (source of truth).

## Notes

- **Secrets management** (ADR-025): NestJS secrets in `.env.local` (gitignored, symlinked to `kebi-config/secrets/api.env.local`); non-secrets in `services/api/config/app.yaml` (committed). Next.js (`apps/web`) uses `.env.local`. FastAPI (`kebi`) uses `config/.local.yaml`. Railway injects secrets as environment variables — names must match the `.env.local` keys exactly.
- **Git comment char is `;`** not `#` — run `git config core.commentChar ";"` once per machine.
- **Bruno API testing**: Collection at `kebi-config/bruno/`. New endpoints need a corresponding `.bru` request file.
- **pgvector**: All vector operations live in kebi. NestJS never touches the database. Embedding dimensions and migrations are kebi's concern only.
- **Deployment**: Vercel (frontend), Railway (backend + AI service + PostgreSQL + Redis). Redis is FastAPI-only. Docker Compose for local dev only.

## Active Technologies
- TypeScript 5.x / Node 20 LTS + Next.js 16 (App Router), React 19, Zustand, Zod, Tailwind v3, shadcn/ui, next-intl, next-themes, Clerk v5 (012-home-subplans-3-7)
- localStorage only (`kebi-app.savedCount`, `kebi-app.savedPlaces`, `kebi-app.tasteProfile`, `kebi-app.location`) — no DB changes (012-home-subplans-3-7)
- TypeScript 5.x, Node 20 LTS (existing). Swift is auto-generated by Capacitor and not hand-written. (013-capacitor-ios-shell)
- None added. The iOS app reuses the web app's existing in-memory and `localStorage` patterns (Zustand home store, Clerk session cookie in WKHTTPCookieStore). (013-capacitor-ios-shell)
- TypeScript 5.x / Node 20 LTS + NestJS 11 (`@nestjs/common`, `@nestjs/axios`, `@nestjs/config`), `class-validator`, `class-transformer`, `@clerk/backend`, `rxjs` (014-signal-context-endpoints)
- N/A — this feature is a stateless gateway pass-through. No TypeORM entity, migration, or DB query changes. Constitution §V preserved. (014-signal-context-endpoints)
- TypeScript 5.x / Node 20 LTS + Next.js 16, React 19, Zustand, Zod, Tailwind v3, shadcn/ui, framer-motion v11 (installed), next-intl, Clerk v5 (015-ui-align-placeobject)
- localStorage only (`kebi-app.savedCount`, `kebi-app.savedPlaces`) (015-ui-align-placeobject)
- TypeScript 5.x / Node 20 LTS + NestJS 11, `@nestjs/config` (ConfigService), `@nestjs/axios` (HttpService), `@clerk/backend`, class-validator, class-transformer (016-gateway-rate-limit)
- In-memory `Map` — no DB, no Redis (NestJS never touches Redis per Constitution §I) (016-gateway-rate-limit)

- TypeScript 5.x / Node 20 LTS + Next.js 16, Tailwind v3, shadcn/ui, next-intl, next-themes, tailwindcss-animate (already installed), framer-motion (pending approval), next/font/google (001-migrate-lovable-design)
- N/A (frontend-only migration) (001-migrate-lovable-design)
- TypeScript 5.x, Node 20 LTS + Next.js 16, `@ai-sdk/react` + `ai` (to install), `@clerk/nextjs` v5, `FetchClient` (existing) (001-wire-consult-streaming)
- N/A — no DB changes (001-wire-consult-streaming)
- TypeScript 5.x / Node 20 LTS + NestJS 11, `class-validator`, `class-transformer`, `@nestjs/axios` (Axios), `@nestjs/config` (002-extract-place-api)
- N/A — no database writes in this feature (002-extract-place-api)
- TypeScript 5.x / Node 20 LTS + NestJS 11, `@nestjs/axios` (HttpService), `class-validator`, `class-transformer` (009-recall-proxy)
- None — recall is a pure proxy (no DB writes) (009-recall-proxy)
- TypeScript 5.x / Node 20 LTS + NestJS 11, `@nestjs/typeorm`, `typeorm`, `pg`, `@paralleldrive/cuid2`, `@nestjs/axios` (stays) (001-gateway-chat-refactor)
- PostgreSQL — TypeORM with `synchronize: true`, two entities (User, UserSettings) (001-gateway-chat-refactor)
- TypeScript 5.x / Node 20 LTS + Next.js 16, React 19, Zustand (new), Zod (new), framer-motion v11 (existing), Tailwind v3, shadcn/ui, Clerk, next-intl (001-home-infra-flow2-flow9)
- localStorage only (no new DB/API writes) (001-home-infra-flow2-flow9)

- TypeScript 5.x / Node 20 LTS + Nx (ADR-001), pnpm (ADR-020), Next.js 16 (apps/web), NestJS 11 (services/api), Tailwind v3 + shadcn/ui (ADR-007) (001-nx-monorepo-setup)
- N/A — this is a workspace configuration feature (001-nx-monorepo-setup)

## Recent Changes

- 012-home-subplans-3-7: Implemented below-threshold confirmation flow for place extraction — shows SaveSheet with "Confirm" badges for candidates with confidence < 70%, auto-saves high-confidence places
- 001-nx-monorepo-setup: Added TypeScript 5.x / Node 20 LTS + Nx (ADR-001), pnpm (ADR-020), Next.js 16 (apps/web), NestJS 11 (services/api), Tailwind v3 + shadcn/ui (ADR-007)
