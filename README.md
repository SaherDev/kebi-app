# kebi-app

Product repo for [Kebi](https://github.com/SaherDev/kebi-app) — an AI-native place decision engine. Next.js frontend, NestJS API gateway, and shared TypeScript libraries. The AI brain lives in [kebi](https://github.com/SaherDev/kebi).

Live: https://kebi-ten-phi.vercel.app

## Docs

| Doc | What's in it |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | System overview, data flows, design patterns |
| [docs/api-contract.md](docs/api-contract.md) | HTTP contract between NestJS and kebi |
| [docs/decisions.md](docs/decisions.md) | Architecture decision records (ADRs) — read before implementing |

## Setup

```bash
pnpm install
cp services/api/.env.example services/api/.env.local   # fill in secrets
cp apps/web/.env.example apps/web/.env.local           # fill in secrets
pnpm nx serve api        # NestJS on http://localhost:3333/api/v1
pnpm nx dev web          # Next.js on http://localhost:4200
```

## Environment Variables

### `services/api` (NestJS)

Secrets go in `services/api/.env.local` (gitignored). Non-secret config is in `services/api/config/app.yaml` (committed).

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection URL |
| `CLERK_SECRET_KEY` | yes | Clerk backend secret key |
| `CLERK_WEBHOOK_SECRET` | yes | Clerk webhook signing secret |
| `APP_CORS_ORIGINS` | yes | Comma-separated allowed origins |
| `AI_SERVICE_BASE_URL` | yes | URL of the kebi service |

### `apps/web` (Next.js)

Secrets go in `apps/web/.env.local` (gitignored).

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | yes | Public URL of the NestJS API |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | yes | Clerk backend secret key |

## Commands

```bash
pnpm nx dev web                    # Next.js dev server
pnpm nx serve api                  # NestJS dev server
pnpm nx test web                   # frontend tests
pnpm nx test api                   # backend tests
pnpm nx run-many -t test           # all tests
pnpm nx run-many -t lint           # lint all
pnpm nx build web                  # build frontend
pnpm nx build api                  # build backend
```
