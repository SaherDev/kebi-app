# Developer Quickstart — Kebi Monorepo

**Updated**: 2026-03-08

## Prerequisites

- Node 20 LTS
- pnpm 10+ (`npm install -g pnpm`)
- PostgreSQL with `vector` extension (for backend, needed later)

## First-Time Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd kebi-app

# 2. Set git comment character (required — allows # in commit messages)
git config core.commentChar ";"

# 3. Install all dependencies (one command, covers all apps and libs)
pnpm install

# 4. Create local config files with your secrets
# Create .env.local in the root (NestJS will use it)
# Create .env.local in apps/web (Next.js will use it)
```

## Running the Apps

```bash
# Frontend (Next.js) — http://localhost:4200
pnpm nx dev web

# Backend (NestJS) — http://localhost:3333/api/v1
pnpm nx serve api

# Both at once (two terminals, or use a process manager)
```

## Running Tests and Lint

```bash
# Lint everything (boundary violations appear here)
pnpm nx run-many -t lint

# Test everything
pnpm nx run-many -t test

# Lint + test only affected projects (faster in CI)
pnpm nx affected -t test,lint
```

## Working with Shared Libraries

### Adding a type to libs/shared

```typescript
// libs/shared/src/lib/types.ts — add your type here
export type YourType = { ... };

// libs/shared/src/index.ts — re-export it
export * from './lib/types.js';
```

Then import in any app:
```typescript
import { YourType } from '@kebi-app/shared';
```

### Adding a component to libs/ui

```typescript
// libs/ui/src/lib/your-component.tsx
export function YourComponent() { ... }

// libs/ui/src/index.ts — re-export it
export * from './lib/your-component.js';
```

Then import in the frontend only:
```typescript
import { YourComponent } from '@kebi-app/ui';
```

**Note**: `@kebi-app/ui` is only importable by `apps/web`. The backend (`services/api`) cannot import from it — the linter will catch this as an error.

## Module Boundary Reference

| Package | Can import from | Cannot import from |
|---------|----------------|-------------------|
| `apps/web` | `@kebi-app/shared`, `@kebi-app/ui` | `services/api` |
| `services/api` | `@kebi-app/shared` | `apps/web`, `@kebi-app/ui` |
| `libs/ui` | `@kebi-app/shared` | `apps/web`, `services/api` |
| `libs/shared` | Nothing | Everything |

Violations are reported as **lint errors** — run `pnpm nx run-many -t lint` to check.

## Configuration

Non-secret configuration lives in `config/dev.yml` (development) and `config/prod.yml` (production). Access via NestJS `ConfigService` — never read env vars directly in application code.

Secrets are stored in per-repo local files: `.env.local` for NestJS and Next.js (in their respective roots). These files are gitignored and must be created locally with your own secret values. CI/CD injects secrets as environment variables at deploy time.

## Commit Format

```
type(scope): description

# Types: feat | fix | chore | docs | refactor | test
# Scopes: api | web | shared
# Example: feat(api): add Clerk auth middleware
```
