# Implementation Plan: Nx Monorepo Workspace Setup

**Branch**: `001-nx-monorepo-setup` | **Date**: 2026-03-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-nx-monorepo-setup/spec.md`

## Summary

Bring the Nx monorepo workspace to a fully operational state: both apps run locally, two shared libraries are importable via the workspace protocol with working public entry points, and module boundary rules enforced by the linter. The majority of infrastructure is already in place — the primary work is creating `libs/ui`, wiring `apps/web` to both shared libraries, adding missing frontend dependencies, and documenting the boundary map.

## Technical Context

**Language/Version**: TypeScript 5.x / Node 20 LTS
**Primary Dependencies**: Nx (ADR-001), pnpm (ADR-020), Next.js 16 (apps/web), NestJS 11 (services/api), Tailwind v3 + shadcn/ui (ADR-007)
**Storage**: N/A — this is a workspace configuration feature
**Testing**: Jest (Nx-inferred targets), ESLint boundary lint
**Target Platform**: Node 20 (backend), browser + Node 20 (frontend SSR)
**Project Type**: Nx monorepo workspace setup
**Performance Goals**: App startup within 5 min from fresh clone (SC-001); new type importable in under 2 min (SC-004)
**Constraints**: pnpm workspace protocol for cross-lib imports (no tsconfig `paths` needed); ESLint-only boundary enforcement (lint step, not build); Tailwind v3 (not v4) per ADR-007
**Scale/Scope**: 2 apps (apps/web, services/api) + 2 libs (libs/shared, libs/ui)

## Constitution Check

*GATE: Must pass before implementation. Re-checked post-research.*

| Rule | Status | Notes |
|------|--------|-------|
| I. Two-Repo Boundary | ✅ Pass | Feature scoped to product repo; no kebi changes |
| II. Nx Module Boundaries | ✅ Pass | Boundary rules already configured correctly in `eslint.config.mjs`; this feature completes the `libs/ui` gap |
| III. ADR-001 (Nx) | ✅ Pass | Nx is the workspace tool |
| III. ADR-003 (YAML config, no .env) | ✅ Pass | config/ directory creation is in scope |
| III. ADR-007 (Tailwind v3 + shadcn/ui) | ✅ Pass | libs/ui setup uses Tailwind v3 |
| III. ADR-020 (pnpm) | ✅ Pass | pnpm workspaces in place |
| IV. Configuration Rules | ✅ Pass | config/dev.yml will be created; no .env files |
| VIII. Code Standards | ✅ Pass | kebab-case files, PascalCase classes, no barrel exports from apps |

**No violations. Cleared to implement.**

## Project Structure

### Documentation (this feature)

```text
specs/001-nx-monorepo-setup/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output (developer onboarding guide)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

*Note: `data-model.md` and `contracts/` are omitted — this feature has no persistent data entities and no external interfaces.*

### Source Code (repository root)

```text
apps/
└── web/                         # Next.js 16 frontend (scope:web)
    ├── package.json             # Add @kebi-app/shared, @kebi-app/ui, missing frontend deps
    ├── tsconfig.json            # Extend tsconfig.base.json
    ├── tailwind.config.js       # CREATE — Tailwind v3 + CSS variable tokens
    ├── src/
    │   └── app/
    │       └── globals.css      # CREATE — CSS variable definitions (:root, .dark)

services/
└── api/                         # NestJS 11 backend (scope:api)
    ├── package.json             # Already has @kebi-app/shared workspace:*
    └── src/
        └── main.ts              # Already imports API_GLOBAL_PREFIX from @kebi-app/shared

libs/
├── shared/                      # Types, interfaces, constants (scope:shared)
│   ├── package.json             # Already configured; exports via workspace protocol
│   └── src/
│       ├── index.ts             # Public entry point — clean up placeholder, add example type
│       └── lib/
│           ├── constants.ts     # API_GLOBAL_PREFIX already exists
│           └── types.ts         # CREATE — example shared type (PlaceSource) to verify wiring
│
└── ui/                          # CREATE — UI components (scope:ui)
    ├── package.json             # name: @kebi-app/ui, tags: scope:ui, exports via workspace protocol
    ├── tsconfig.json            # Extend tsconfig.base.json
    ├── tsconfig.lib.json        # Compilation config
    └── src/
        ├── index.ts             # Public entry point — exports example component + cn()
        └── lib/
            ├── utils.ts         # cn() utility (clsx + tailwind-merge)
            └── button.tsx       # CREATE — example Button component (cva variants) to verify wiring

config/
├── dev.yml                      # CREATE — non-secret config (ai_service.base_url, ports)
└── prod.yml                     # CREATE — production config skeleton

messages/
├── en.json                      # CREATE — English translations skeleton
└── he.json                      # CREATE — Hebrew translations skeleton (RTL)

eslint.config.mjs                # Already configured with scope:* boundary rules
tsconfig.base.json               # Already configured; NO paths object (pnpm handles resolution)
pnpm-workspace.yaml              # Already configured
nx.json                          # Already configured with all plugins
```

**Structure Decision**: Nx Nx-plugin-inferred targets for `apps/web` (Next.js plugin) and custom targets in `package.json` `nx` field for `services/api`. No `project.json` files needed where plugins can infer targets. The `libs/ui` library follows the same package.json-based pattern as `libs/shared`.

## Implementation Steps

### Step 1 — Create libs/ui

Create the UI component library from scratch, mirroring `libs/shared`'s package structure.

**Files to create:**

1. `libs/ui/package.json` — ESM package with `name: @kebi-app/ui`, `tags: ["scope:ui"]`, workspace protocol exports, `@kebi-app/source` custom condition
2. `libs/ui/tsconfig.json` — composite tsconfig extending `tsconfig.base.json`
3. `libs/ui/tsconfig.lib.json` — compilation config with `rootDir: src`, `outDir: dist`
4. `libs/ui/src/index.ts` — public entry point exporting `cn()` and `Button`
5. `libs/ui/src/lib/utils.ts` — `cn()` via `clsx` + `tailwind-merge`
6. `libs/ui/src/lib/button.tsx` — example Button with `cva` variants (`default`, `muted`, `outline`)
7. `libs/ui/eslint.config.mjs` — extends root config

**Key constraint**: `libs/ui` must list `@kebi-app/shared` as a dependency (workspace:*) since it is allowed to depend on `scope:shared`. It must NOT import from `apps/web` or `services/api`.

### Step 2 — Add example type to libs/shared

Remove the placeholder `shared()` function. Add one real example type (`PlaceSource`) to prove the shared type pipeline works end-to-end.

**Files to modify:**
- `libs/shared/src/lib/types.ts` — CREATE with `export type PlaceSource = 'saved' | 'discovered'`
- `libs/shared/src/lib/shared.ts` — DELETE or repurpose (remove placeholder `shared()` function)
- `libs/shared/src/index.ts` — Update to export from `types.ts`

### Step 3 — Wire apps/web to both libraries

Add `@kebi-app/shared` and `@kebi-app/ui` as workspace dependencies in `apps/web`. Add all missing frontend dependencies.

**Files to modify:**
- `apps/web/package.json` — Add:
  - `@kebi-app/shared: workspace:*`
  - `@kebi-app/ui: workspace:*`
  - `tailwindcss`, `autoprefixer`, `postcss` (Tailwind v3)
  - `tailwindcss-animate` (shadcn/ui animations)
  - `clsx`, `tailwind-merge` (consumed by libs/ui but peer deps needed)
  - `next-themes` (dark mode)
  - `next-intl` (i18n)
  - `@clerk/nextjs` (auth, frontend SDK)

**Files to create:**
- `apps/web/tailwind.config.js` — Tailwind v3 config with CSS variable color tokens, `libs/ui` in content paths
- `apps/web/postcss.config.js` — PostCSS config for Tailwind
- `apps/web/src/app/globals.css` — CSS variable definitions (`:root` + `.dark`)

### Step 4 — Create config/ directory

Provide YAML configuration skeleton per ADR-003 and ADR-012.

**Files to create:**
- `config/dev.yml` — `ai_service.base_url`, port config, feature flags
- `config/prod.yml` — production skeleton (base_url as placeholder)

### Step 5 — Create messages/ directory

Provide i18n translation skeletons per frontend standards.

**Files to create:**
- `messages/en.json` — English skeleton with top-level namespace keys
- `messages/he.json` — Hebrew skeleton (same structure)

### Step 6 — Verify both apps run

Run both apps locally and confirm no startup errors:
- `pnpm nx dev web` → Next.js serves on port 4200
- `pnpm nx serve api` → NestJS serves on port 3333

### Step 7 — Verify lint and boundary enforcement

- `pnpm nx run-many -t lint` → passes clean with no boundary violations
- Manually introduce a boundary violation (services/api importing from libs/ui) → verify lint catches it

### Step 8 — Document boundary map

Add a boundary reference table to `CLAUDE.md` or `docs/architecture.md` documenting the import rules per SC-006.

## Complexity Tracking

No constitution violations — no complexity justification needed.
