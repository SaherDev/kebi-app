# CLAUDE.md — Kebi Product Repo

## Project Context

Kebi is an AI-native place decision engine. The AI IS the product — this repo is the product layer around it. Users share places over time (free-text, URLs, descriptions), the system builds a taste model, and returns one confident recommendation from natural language intent. Nx monorepo: Expo/React Native mobile app (`apps/mobile`), Next.js web app (`apps/web`), NestJS backend (`services/api`), shared TypeScript types (`libs/shared`). NestJS is a **thin gateway** — it authenticates, forwards AI requests, and owns product tables only. All AI logic lives in a separate Python repo (`kebi`, FastAPI), the **autonomous AI brain**. Full design: @docs/architecture.md; HTTP contract: `docs/api-contract.md`.

## Key Directories

```
apps/mobile/          → Expo/React Native app (NativeWind, Supabase auth) — primary client
apps/web/             → Next.js frontend (Tailwind v3, shadcn/ui, Clerk auth)
services/api/         → NestJS backend (auth gateway, product tables only)
libs/shared/          → Shared TypeScript types, DTOs, constants
libs/ui/              → Design system (shadcn/ui components, cva variants, cn() utility)
apps/mobile/src/i18n/ → Mobile i18n strings (en.json); web: apps/web/messages/
docs/                 → Operational docs (architecture, API contract, decisions/ADRs)
.claude/rules/        → Claude Code rules (git, architecture, frontend, standards)
```

## Common Commands

```bash
pnpm dev:mobile                # Metro bundler → press i for iOS simulator (never npx expo from repo root)
pnpm nx serve api              # NestJS on http://localhost:3333/api/v1
pnpm nx test mobile            # Mobile tests (jest-expo)
pnpm nx test api               # Backend tests (Jest)
pnpm nx run-many -t test       # All tests
pnpm nx run-many -t lint
pnpm nx build api
```

## Standards

Details in @.claude/rules/standards.md, @.claude/rules/architecture.md, @.claude/rules/frontend.md, and @.claude/rules/tailwind-patterns.md.

- **Zero hardcoding** — config (YAML/env vars) or constants in `libs/shared`; literals invite drift
- **Path aliases** — `@kebi-app/shared`, `@kebi-app/ui`; app-internal imports use relative paths
- **Naming** — files: `kebab-case.ts`, classes: `PascalCase`, DTOs: `PascalCase` + `Dto` suffix
- **Types** — shared types in `libs/shared`, never duplicated; Zod schemas validate AI responses at runtime
- **Linting** — Nx-generated ESLint configs only, no plugins, no inline disables without a comment
- **Nx boundaries** — apps import `libs/shared` + `libs/ui`; `services/api` imports `libs/shared` only; `libs/shared` imports nothing
- **Architecture** — NestJS: authenticate, forward to kebi, return the response; it writes product tables only (users, user_settings) — FastAPI owns all AI tables, migrations, and vector/pgvector work
- **Auth** — web: Clerk; mobile: Supabase OTP/OAuth behind the gateway (ADR-044: client stays blind to identity)
- **API routes** — all NestJS routes use `/api/v1/` prefix; kebi is called via its `/v1/*` endpoints (ADR-036)
- **Commits** — `type(scope): description`, types: `feat|fix|chore|docs|refactor|test`, scopes: `api|web|mobile|shared|ui` (details in @.claude/rules/git.md)
- **Code quality** — single responsibility, constructor injection only, strategy pattern over if/switch on type, no duplication (extract to `libs/shared`), new behavior = new class; fix violations before presenting code

## Workflow

See `.claude/workflows.md` for the full 5-step workflow (ADR-028) and model/token assignments.

1. **Clarify** — if ambiguous (3+ unknowns), ask up to 5 questions first.
2. **Plan** — if 3+ files or crossing the repo boundary, write `docs/plans/YYYY-MM-DD-<feature>.md`.
3. **Implement** — follow the plan, commit per `.claude/rules/git.md`.
4. **Verify** — `pnpm nx affected -t test,lint`; all must pass.
5. **Complete** — mark done, update task status only.

**Read `docs/decisions.md` FIRST** — every ADR is a binding constraint; if your approach contradicts one, stop and flag it before writing code. Constitution check: `.claude/constitution.md`. If a skill's guidance conflicts with project standards, project standards win.

## Notes

- **Secrets** (ADR-025): never committed — NestJS: `.env.local` (symlink to `kebi-config/secrets/api.env.local`); mobile: `.env`/`.env.production` symlinks; FastAPI: `config/.local.yaml`. Railway env var names must match the `.env.local` keys exactly.
- **Non-secret backend config** lives in `services/api/config/app.yaml` (committed).
- **Git comment char is `;`** not `#` — run `git config core.commentChar ";"` once per machine.
- **Bruno API testing**: collection at `kebi-config/bruno/`; new endpoints need a `.bru` request file.
- **Deployment**: Vercel (web), Railway (api + kebi + PostgreSQL + Redis); Redis is FastAPI-only; Docker Compose is local-dev only.
