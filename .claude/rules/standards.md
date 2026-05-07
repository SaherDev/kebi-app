# Coding Standards — Kebi Product Repo

## Zero Hardcoding

- Nothing is hardcoded. Every value that could change — URLs, ports, labels, limits, thresholds, feature flags, UI text — must come from config (YAML for non-secrets, env vars for secrets) or a constants file in `libs/shared`.
- Frontend UI strings, colors, and layout parameters are configurable — not buried in components.
- If you're about to type a literal value that isn't a boolean, 0, or 1, extract it to config or a named constant.

## Linting

- ESLint: use Nx-generated configs only. Do not add plugins or override generated rules.
- Never disable an ESLint rule inline without a comment explaining why.

## Path Aliases

- `@kebi-app/shared` → `libs/shared/src`
- `@kebi-app/ui` → `libs/ui/src`
- App-internal imports use relative paths

## Naming Patterns

- Files: `kebab-case.ts` (e.g., `place-recommendation.service.ts`)
- Classes: `PascalCase` (e.g., `PlaceRecommendationService`)
- Interfaces/Types: `PascalCase`, no `I` prefix (e.g., `PlaceResult`, not `IPlaceResult`)
- DTOs: `PascalCase` + `Dto` suffix (e.g., `CreatePlaceDto`)
- NestJS modules: one module per domain (e.g., `places/`, `recommendations/`)

## Type Conventions

- All shared types live in `libs/shared` — never duplicate types between apps
- API responses use shared DTOs; frontend consumes the same types
- Database entities are TypeORM classes with `@Entity()` and `@Column()` decorators in `services/api`; do not duplicate them in `libs/shared`

## Technical Notes

- **pgvector**: PostgreSQL must have the `vector` extension enabled. All vector operations live in kebi (FastAPI + Alembic). NestJS never defines or queries vector columns.
- **Clerk middleware**: Runs in both Next.js middleware and NestJS guards. Auth state is verified independently in each app — do not pass raw tokens between apps; use Clerk's backend SDK to verify.
- **Config split**: `services/api/config/app.yaml` (committed) contains port, api prefix, public paths, and AI feature flags. Secrets go in `.env.local` (gitignored, symlinked to `kebi-config/secrets/api.env.local`). Both are loaded by `ConfigModule` at startup.
- **Free-text place input**: The frontend sends a raw string to the API. The API forwards it to kebi for parsing. kebi writes the place and embedding directly to PostgreSQL and returns a confirmation (place_id + metadata). This repo never parses place names, URLs, or extracts metadata — that is the AI repo's job.
- **kebi returns 1+2**: One primary recommendation plus two alternatives. Each has: place name, address, reasoning text, source (saved vs discovered). Do not expect or depend on additional fields until they are added.
- **No committed secrets**: NestJS secrets in `.env.local` (gitignored, symlinked to `kebi-config/secrets/api.env.local`). Next.js secrets in `.env.local`. FastAPI secrets in `config/.local.yaml`. Never commit secret files.
- **git comment character**: This repo uses `;` as git's comment character (not `#`). Run `git config --global core.commentChar ";"` once per machine.
