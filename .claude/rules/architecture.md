# Architecture Rules — Kebi Product Repo

## First Principle

The AI IS the product. NestJS is supporting infrastructure. kebi (FastAPI) is the autonomous brain. This repo is the thin gateway and schema owner.

## NestJS: Four Responsibilities Only

1. **Authenticate** every request (Clerk)
2. **Forward** AI requests to FastAPI with user context (user_id, location)
3. **Write product data** to PostgreSQL (users, user_settings, recommendation history)
4. **CRUD** for user-facing operations (user settings, recommendation history)

NestJS does NOT write place records, embeddings, or taste model data. FastAPI writes those directly to PostgreSQL.

If you are writing code in this repo that calls an LLM, generates embeddings, parses free-text input, runs vector search, or calls Google Places API — stop. That belongs in `kebi`.

## kebi: Autonomous AI Brain

FastAPI owns the entire AI pipeline. It writes AI-generated data (places, embeddings, taste model) directly to PostgreSQL. It has read-write access to Redis. It calls external APIs (Google Places, LLM providers) directly. It runs the full agent graph via LangGraph. NestJS never intervenes mid-pipeline.

## Nx Boundaries

| Source         | Can import from          | Cannot import from                    |
| -------------- | ------------------------ | ------------------------------------- |
| `apps/web`     | `libs/shared`, `libs/ui` | `services/api`                        |
| `services/api` | `libs/shared`            | `apps/web`, `libs/ui`                 |
| `libs/ui`      | `libs/shared`            | `apps/web`, `services/api`            |
| `libs/shared`  | (nothing)                | `apps/web`, `services/api`, `libs/ui` |

These boundaries are enforced by Nx module boundary rules. If you get a lint error about a cross-boundary import, do not suppress it — move the shared code into the appropriate lib. Note: `libs/ui` is frontend-only — `services/api` must never import from it.

## Two-Repo Separation

| Concern          | This repo (`kebi-app`)                                     | AI repo (`kebi`)                                                                                               |
| ---------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Language         | TypeScript                                               | Python                                                                                                              |
| Runtime          | Node 20                                                  | Python 3.11+                                                                                                        |
| Role             | Thin gateway + schema owner                              | Autonomous AI brain                                                                                                 |
| Responsibilities | Auth, user CRUD, recommendation history, HTTP forwarding | Intent parsing, embeddings, vector search, ranking, LLM calls, Google Places, writing places/embeddings/taste_model |
| Database access  | Read-write for product tables (TypeORM)                  | Read-write for AI tables (direct connection)                                                                        |
| Redis access     | None                                                     | Read-write (LLM cache, session state, agent state)                                                                  |
| Communication    | Sends HTTP requests                                      | Receives HTTP requests                                                                                              |

**Hard rule:** This repo never runs ML models, parses free-text place input, calls embedding APIs, runs vector queries, or calls Google Places API. If you find yourself importing an NLP library or writing text extraction logic, stop — that belongs in `kebi`.

## Database Ownership

Write ownership is split by domain. Each service writes to its own tables. Neither service writes to the other's tables. This prevents race conditions and conflicting updates.

Migration ownership is split by domain. TypeORM (synchronize: true) in this repo manages product tables (users, user_settings). Alembic in kebi owns and migrates AI tables (places, embeddings, taste_model, consult_logs, user_memories, interaction_log). NestJS entities must only reference product tables — never AI-owned tables.

- **NestJS writes and reads:** users, user_settings, recommendations (history of consult results)
- **FastAPI writes and reads:** places, embeddings, taste_model
- **FastAPI writes to Redis:** LLM cache, session context, intermediate agent state

Both services read from any table as needed. One shared PostgreSQL instance. Two connection strings with appropriate write permissions.

**pgvector is owned entirely by kebi.** NestJS never defines or queries vector columns. If the embedding model changes, only kebi's Alembic migration and config need updating.

## AI Service Communication

- All calls to `kebi` originate from `services/api` (NestJS services).
- `apps/web` never calls `kebi` directly. The frontend talks to the NestJS API, which forwards to the AI service.
- The AI service base URL is loaded from `AI_SERVICE_BASE_URL` env var (`.env.local` locally, Railway variable in production).
- Single endpoint: `POST /v1/chat`. The AI service classifies intent internally. See @docs/api-contract.md for the full schema.

## API Versioning

All NestJS routes use the `/api/v1/` global prefix. Set via `app.setGlobalPrefix('api/v1')` in `main.ts`.

## Deployment

| Service                 | Platform | Tier                      |
| ----------------------- | -------- | ------------------------- |
| `apps/web` (Next.js)    | Vercel   | Free Hobby                |
| `services/api` (NestJS) | Railway  | Hobby $5/mo               |
| `kebi` (FastAPI)   | Railway  | Hobby $5/mo               |
| PostgreSQL + pgvector   | Railway  | Hobby $5/mo               |
| Redis                   | Railway  | Serverless (FastAPI-only) |

Docker Compose is for local development only. Never deploy Docker containers to production.

## Coding Constraints

- **TypeORM is NestJS's database access layer.** Register only `UserEntity` and `UserSettingsEntity`. FastAPI writes to its own tables directly. NestJS never queries AI-owned tables.
- **Clerk is the only auth provider.** Do not implement custom JWT verification or session management.
- **One NestJS module per domain.** Each business domain (places, recommendations, users) gets its own module with its own service and controller.
- **Shared types are the contract.** If both apps need a type, it goes in `libs/shared`. If only one app uses it, keep it local to that app.
- **No barrel exports from apps.** Only `libs/shared` exposes a public API via `index.ts`.
- **NestJS does not touch Redis.** All caching and session state is FastAPI's concern.
