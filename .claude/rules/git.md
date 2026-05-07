# Git Conventions — Kebi Product Repo

## Branch Strategy

```
main          ← stable only, merge when a feature/phase is complete and tested
  └─ dev      ← active development, day-to-day work
       └─ <number>-<feature-name>               (spec-kit feature branch, e.g., 001-nx-monorepo-setup)
       └─ feature/<short-description>           (manual feature, e.g., feature/clerk-auth)
       └─ fix/<short-description>               (hotfix, e.g., fix/auth-token-expiry)
```

### Spec-kit Features

- Spec-kit auto-generates numbered branches: `001-feature-name`, `002-another-feature`, etc.
- These are created from `dev` and merged back into `dev` when the feature is complete.
- Numbered naming provides systematic tracking of multiple concurrent features in the monorepo.
- When a feature is fully tested, merge branch into `dev` (squash or merge commit, your call).
- Then merge `dev` into `main` at phase milestones (regular merge, not squash).

### Manual Features & Hotfixes

- Manual features use `feature/<short-description>` pattern.
- Hotfixes use `fix/<short-description>` pattern.
- Both are created from `dev` and merged back into `dev` following the same flow.
- Never push directly to `main`.
- Delete feature/fix branches after merge.

## Commit Message Format

```
type(scope): description
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`

**Scopes:** Target the primary affected Nx workspace package:
- `api` — NestJS backend (services/api)
- `web` — Next.js frontend (apps/web)
- `shared` — Shared types & utilities (libs/shared)
- `ui` — UI component library (libs/ui)
- For changes affecting multiple packages, prioritize the primary one

Examples:
```
feat(shared): add PlaceSource type
fix(web): correct redirect after sign-in
chore(api): update auth middleware
docs(ui): add Button component examples
refactor(shared): simplify DTO exports
```

### Rules

- One logical change per commit. Do not bundle unrelated changes.
- Write in imperative mood: "add feature" not "added feature".
- Keep the subject line under 72 characters.

## Merge Flow

1. Create a feature or fix branch from `dev`.
2. Work on the branch, commit with conventional format.
3. When complete, merge branch into `dev` (squash or merge commit, your call per branch).
4. Delete the source branch after merge.
5. When a milestone is ready, merge `dev` into `main` (regular merge, not squash).

> **`main` is production.** Merges into `main` are done manually by the repo owner only —
> via a PR or squash merge. Claude Code never merges or pushes directly to `main`.
