# Tasks: Nx Monorepo Workspace Setup

**Input**: Design documents from `specs/001-nx-monorepo-setup/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | quickstart.md ✅

**Tests**: Not requested in spec — no TDD test tasks included. Verification steps (lint, run, typecheck) are included as implementation tasks.

**Organization**: Tasks grouped by user story — each story is independently implementable and testable.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Resolve cross-cutting prerequisites not owned by any single user story.

- [X] T001 Verify `pnpm install` completes without errors from repo root (smoke check before any work)
- [X] T002 [P] Create `config/dev.yml` with non-secret config skeleton: `ai_service.base_url`, `web.port: 4200`, `api.port: 3333`
- [X] T003 [P] Create `config/prod.yml` with production config skeleton (base_url as placeholder, same keys as dev.yml)
- [X] T004 [P] Create `messages/en.json` with top-level namespace skeleton: `{ "common": {}, "recommendation": {}, "place": {} }`
- [X] T005 [P] Create `messages/he.json` with identical structure to `messages/en.json` (empty values, Hebrew locale)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create `libs/ui` — required by both US1 (apps/web startup) and US2 (shared component imports). No user story can be fully tested until this phase is complete.

**⚠️ CRITICAL**: US1 and US2 both depend on `libs/ui` existing and being installed.

- [X] T006 Create `libs/ui/package.json` — `name: @kebi-app/ui`, `"type": "module"`, `"tags": ["scope:ui"]` in `nx` field, conditional exports with `@kebi-app/source` pointing to `./src/index.ts`, deps: `@kebi-app/shared: workspace:*`, `clsx`, `tailwind-merge`, `class-variance-authority`
- [X] T007 [P] Create `libs/ui/tsconfig.json` — composite tsconfig extending `../../tsconfig.base.json`, `files: []`, `references` to `tsconfig.lib.json` and `tsconfig.spec.json`
- [X] T008 [P] Create `libs/ui/tsconfig.lib.json` — extends `../../tsconfig.base.json`, `compilerOptions`: `jsx: preserve`, `rootDir: src`, `outDir: dist`, `module: nodenext`, `moduleResolution: nodenext`, `experimentalDecorators: true`, `include: ["src/**/*.ts", "src/**/*.tsx"]`
- [X] T009 Create `libs/ui/src/lib/utils.ts` — export `cn(...inputs: ClassValue[])` using `clsx` + `tailwind-merge`
- [X] T010 Create `libs/ui/src/lib/button.tsx` — export `Button` component with `cva` variants (`default`, `muted`, `outline`, `ghost`; sizes `sm`, `default`, `lg`, `icon`); uses `cn()` from `./utils`
- [X] T011 Create `libs/ui/src/index.ts` — public entry point: `export * from './lib/utils.js'` and `export * from './lib/button.js'`
- [X] T012 [P] Create `libs/ui/eslint.config.mjs` — extends `../../eslint.config.mjs` (same pattern as `libs/shared`)
- [X] T013 Run `pnpm install` from repo root to link `libs/ui` into workspace node_modules as `@kebi-app/ui`

**Checkpoint**: `libs/ui` is installed. Run `pnpm nx lint ui` — must pass with no boundary violations before proceeding.

---

## Phase 3: User Story 1 — Developer Runs Both Apps Locally (Priority: P1) 🎯 MVP

**Goal**: A developer clones the repo, runs `pnpm install`, starts both apps, and each serves on its designated port with no errors.

**Independent Test**: `pnpm nx dev web` → browser shows Next.js page at http://localhost:4200. `pnpm nx serve api` → curl http://localhost:3333/api/v1 returns a response. Both can be stopped/started independently.

### Implementation

- [X] T014 [US1] Add `@kebi-app/shared: workspace:*` and `@kebi-app/ui: workspace:*` to `apps/web/package.json` dependencies
- [X] T015 [US1] Add frontend-specific dependencies to `apps/web/package.json`: `tailwindcss`, `autoprefixer`, `postcss`, `tailwindcss-animate`, `next-themes`, `next-intl`, `@clerk/nextjs`
- [X] T016 [P] [US1] Create `apps/web/tailwind.config.js` — Tailwind v3 config: `darkMode: 'class'`, content includes `./src/**/*.{ts,tsx}` and `../../libs/ui/src/**/*.{ts,tsx}`, theme extends with CSS variable color tokens (`primary`, `foreground`, `background`, `muted`, `accent`, `border`, `ring`, `destructive`) and `borderRadius` using `var(--radius)`, plugin: `tailwindcss-animate`
- [X] T017 [P] [US1] Create `apps/web/postcss.config.js` — `{ plugins: { tailwindcss: {}, autoprefixer: {} } }`
- [X] T018 [US1] Create `apps/web/src/app/globals.css` — `@tailwind base/components/utilities`, `:root` CSS variables (HSL raw values for all tokens), `.dark` overrides, `@layer base` body styles
- [X] T019 [US1] Run `pnpm install` to resolve new `apps/web` dependencies
- [X] T020 [US1] Verify `pnpm nx dev web` starts without errors and serves on port 4200 (fix any startup errors before proceeding)
- [X] T021 [US1] Verify `pnpm nx serve api` starts without errors and serves on port 3333 (fix any startup errors before proceeding)

**Checkpoint**: Both apps start cleanly. US1 is independently testable — stop one app, the other keeps running.

---

## Phase 4: User Story 2 — Developer Uses Shared Types Without Duplication (Priority: P2)

**Goal**: A developer adds a type to `libs/shared` and a component to `libs/ui`, imports them in both apps using their path alias, and the project typechecks without errors.

**Independent Test**: `pnpm nx run-many -t build` (or `typecheck`) passes. Import `PlaceSource` from `@kebi-app/shared` in both `apps/web` and `services/api`. Import `Button` from `@kebi-app/ui` in `apps/web`. No type errors in any project.

### Implementation

- [X] T022 [US2] Create `libs/shared/src/lib/types.ts` — `export type PlaceSource = 'saved' | 'discovered'` (used in consult API response per api-contract.md; proves shared type pipeline end-to-end)
- [X] T023 [US2] Remove placeholder `shared()` function from `libs/shared/src/lib/shared.ts` (or delete the file if it contains only the placeholder)
- [X] T024 [US2] Update `libs/shared/src/index.ts` — add `export * from './lib/types.js'`; remove export of deleted `shared.ts` if applicable
- [X] T025 [P] [US2] Add `import type { PlaceSource } from '@kebi-app/shared'` to `services/api/src/main.ts` (or a new `services/api/src/lib/types.ts`) and use the type in a comment or type assertion — verifies backend can import shared types
- [X] T026 [P] [US2] Update `apps/web/src/app/page.tsx` to import `PlaceSource` from `@kebi-app/shared` and `Button` from `@kebi-app/ui` — render a `<Button>` element to verify both frontend imports resolve with full type-checking
- [X] T027 [US2] Run `pnpm nx run-many -t lint` — must pass with zero errors across all projects
- [X] T028 [US2] Run typecheck across all projects (e.g., `pnpm nx run-many -t build` or equivalent) — verify zero type errors; fix any type mismatches before proceeding

**Checkpoint**: Both path aliases (`@kebi-app/shared`, `@kebi-app/ui`) resolve correctly from all permitted consumers. Changing a shared type causes a type error in any consumer that becomes mismatched.

---

## Phase 5: User Story 3 — Developer Is Prevented from Crossing Module Boundaries (Priority: P3)

**Goal**: A developer who writes a disallowed cross-boundary import sees a lint error immediately, before any build. A written boundary reference exists in project documentation.

**Independent Test**: Add `import { Button } from '@kebi-app/ui'` to `services/api/src/main.ts` → `pnpm nx lint api` reports a boundary violation. Remove the import → lint passes. The boundary table in `docs/architecture.md` is readable without opening any config file.

### Implementation

- [X] T029 [US3] Verify boundary enforcement works: temporarily add `import { Button } from '@kebi-app/ui'` to `services/api/src/main.ts`, run `pnpm nx lint api`, confirm error mentions `@nx/enforce-module-boundaries`; then remove the import and confirm lint passes
- [X] T030 [US3] Add or verify module boundary table in `docs/architecture.md` under a `## Module Boundaries` section — must show all four rules (apps/web, services/api, libs/ui, libs/shared) in a readable markdown table; must be accurate against the current eslint.config.mjs rules

**Checkpoint**: Boundary violations caught 100% of the time by lint. Table in docs/ is the single source of truth for new developers.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation that all three user stories work together and the workspace is clean.

- [X] T031 Run `pnpm nx run-many -t lint` across all projects — must be zero errors; fix any remaining issues
- [X] T032 [P] Run `pnpm nx run-many -t test` — all existing tests pass; no broken tests from the changes in this feature
- [X] T033 Walk through `specs/001-nx-monorepo-setup/quickstart.md` first-run steps end-to-end and verify every command produces the expected output; update quickstart if any step is wrong
- [X] T034 [P] Review `docs/architecture.md` boundary table against `eslint.config.mjs` — confirm they match exactly; update docs if any discrepancy

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T002–T005 can start immediately in parallel
- **Foundational (Phase 2)**: Starts after T001; T006–T012 run in sequence/parallel within phase; T013 (install) unblocks US1 and US2
- **US1 (Phase 3)**: Depends on T013 (libs/ui installed); T014–T019 setup, T020–T021 verify
- **US2 (Phase 4)**: Depends on T013 (libs/ui installed) and T019 (apps/web deps installed); T025 and T026 run in parallel
- **US3 (Phase 5)**: Depends on T027–T028 (lint/typecheck passing); T029–T030 can run in parallel
- **Polish (Phase 6)**: Depends on all story phases complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no dependency on US2 or US3
- **US2 (P2)**: After Phase 2 — no dependency on US1 (except shared install step T019)
- **US3 (P3)**: After US2 (lint must pass first) — validates boundary rules are clean

### Within Each Story

- Add dependencies → run install → add config files → verify runtime
- Type-level changes (US2) before lint verification
- Lint verification before boundary testing (US3)

---

## Parallel Opportunities

### Phase 1 (Setup)
```
T002 (config/dev.yml) ─┐
T003 (config/prod.yml) ─┤── all can run simultaneously
T004 (messages/en.json) ─┤
T005 (messages/he.json) ─┘
```

### Phase 2 (Foundational)
```
T006 (package.json) → T007 (tsconfig.json) ─┐
                      T008 (tsconfig.lib.json) ┤── parallel
                      T012 (eslint.config.mjs) ┘
→ T009 (utils.ts) → T010 (button.tsx) → T011 (index.ts) → T013 (pnpm install)
```

### Phase 3 (US1)
```
T014+T015 (deps) → T019 (install) → T016 (tailwind.config.js) ─┐ parallel
                                      T017 (postcss.config.js)  ─┤
                                      T018 (globals.css)         ─┘
→ T020 (verify web) + T021 (verify api) — can verify in parallel
```

### Phase 4 (US2)
```
T022 (types.ts) → T023+T024 (shared index cleanup)
→ T025 (api import) ─┐ parallel
  T026 (web import)  ─┘
→ T027 (lint) → T028 (typecheck)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational — create libs/ui (T006–T013)
3. Complete Phase 3: US1 — wire apps/web, verify both apps run (T014–T021)
4. **STOP and VALIDATE**: `pnpm nx dev web` + `pnpm nx serve api` both serve cleanly
5. US1 is done — two working apps from a single workspace root

### Incremental Delivery

1. Setup + Foundational → `libs/ui` exists and lints clean
2. US1 → Both apps run locally (MVP!)
3. US2 → Shared types and components import correctly from both apps
4. US3 → Boundary violations caught; boundary map documented
5. Polish → Full lint/test pass; quickstart validated

### Parallel Team Strategy

With two developers after Phase 2 is complete:
- Dev A: US1 (apps/web wiring, Tailwind, startup verification)
- Dev B: US2 (libs/shared cleanup, type pipeline)
- US3 and Polish done together after both complete

---

## Notes

- `[P]` tasks touch different files with no shared-state dependencies — safe to parallelize
- `[US1/2/3]` labels trace each task back to its user story for scope control
- No test tasks generated — spec did not request TDD; lint and runtime verification serve as acceptance gates
- Boundary enforcement (US3) relies on `eslint.config.mjs` already being correct — research confirmed it is
- T029 is a deliberate red-green check: introduce violation → confirm error → remove → confirm clean
- `PlaceSource` type (T022) is not throwaway scaffolding — it maps to a real API response field in `api-contract.md`
