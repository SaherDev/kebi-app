# System Architecture — Kebi (Product Repo)

## Overview

Kebi is split across two repositories. This repo (kebi-app) is the product layer. It owns the UI, authentication, and the HTTP gateway to the AI brain. It delegates all AI work and all database writes to the kebi repo over HTTP.

```
┌─────────────────────────────────────────────────────┐
│                    User (Browser)                    │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────┐
│              apps/web (Next.js + Clerk)              │
│  - UI rendering, client-side state                  │
│  - Clerk auth (frontend SDK)                        │
│  - Calls services/api via internal HTTP             │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (REST)
                       ▼
┌─────────────────────────────────────────────────────┐
│              services/api (NestJS)                   │
│  - Auth verification (Clerk backend SDK)            │
│  - Forwards all user messages to kebi          │
│  - No database writes                               │
└─────────────────────────────┬───────────────────────┘
                              │ HTTP (JSON) — signed /v1 calls
                              ▼
┌──────────────────────┐  ┌──────────────────────────┐
│  PostgreSQL           │  │  kebi (FastAPI)     │
│  + pgvector           │  │  - Classifies intent     │
│                       │  │  - Runs agent pipeline   │
│  FastAPI writes:      │  │  - Generates embeddings  │
│  - places             │  │  - Owns all DB writes    │
│  - place_embeddings   │  │                          │
│  - user_places        │  │                          │
│  - taste_model        │  │                          │
│  - interactions       │  │                          │
│  - user_memories      │  │                          │
└──────────────────────┘  └──────────────────────────┘
```

## What This Repo Owns

- All user-facing UI (Next.js)
- Authentication and authorization (Clerk)
- HTTP gateway: verifies the Clerk session, forwards to kebi's `/v1` endpoints (chat, extract, signal, user-data) over signed service-to-service requests, returns the response

## What This Repo Does NOT Do

- Call LLM providers (OpenAI, Anthropic)
- Generate embeddings
- Run vector similarity search
- Call Google Places API
- Write place records or embeddings (FastAPI owns these)
- Touch Redis

## Data Flow: User Interactions

Conversational turns and saves use different kebi endpoints — the chat path is
conversation-only and never writes saves:

1. User submits input in the client app.
2. The client calls services/api — `POST /api/v1/chat` for a conversational turn, `POST /api/v1/extract` to save a URL or place name.
3. services/api verifies the Clerk session, then forwards to kebi over HTTP, signing each request with `X-Gateway-Token` (shared secret) and `X-Gateway-User-Id` (the verified Clerk subject). `user_id` is never a body field. For chat it also injects `movement_profile`, read from the Clerk `publicMetadata` claim.
4. kebi handles the request autonomously — for chat, a LangGraph agent turn driven by the consult-family tools (`find_saved`, `suggest_places`, `discover_places`).
5. kebi returns a typed response — chat: `ChatResponse` with `type` `"agent"` or `"error"` plus `data.tool_results`; extract: `ExtractPlaceResponse`.
6. services/api returns HTTP 200. Downstream failures arrive as `type: "error"` with HTTP 200; real HTTP codes (401/403/429/503) are reserved for transport failures only.
7. The client renders UI from the response.

NestJS never inspects AI response content — it forwards and returns.

## Chat Response Shape

The chat endpoint returns no intent taxonomy. A turn is an autonomous agent run
inside kebi; the top-level `type` is only ever `agent` or `error`. What the
agent did surfaces in `data.tool_results` — each a `ConsultResult` produced by
one of the consult-family tools (`find_saved`, `suggest_places`,
`discover_places`) — and in the user-visible `data.reasoning_steps`. Saving a
place is a separate endpoint (`POST /v1/extract`), not a chat intent.

Empty state: a tool that finds nothing returns a `ConsultResult` carrying an
`empty_reason` (e.g. `no_location`, `no_match`) rather than a zero-result error.

## API Contract (NestJS to kebi)

All protected calls carry `X-Gateway-Token` + `X-Gateway-User-Id` headers (identity is never a body field). See `docs/api-contract.md` for the full request/response schemas.

| Endpoint              | Purpose                         | kebi Returns                                          |
| --------------------- | ------------------------------- | ----------------------------------------------------- |
| POST /v1/chat         | Conversational agent turn       | `ChatResponse` (`type` `agent`\|`error`)              |
| POST /v1/chat/stream  | SSE streaming chat              | `reasoning_step` / `tool_result` / `message` / `done` |
| POST /v1/extract      | Save a URL or place name        | `ExtractPlaceResponse`                                |
| POST /v1/signal       | Recommendation accept/reject    | `202 { status }`                                      |
| DELETE /v1/user/data  | Wipe AI-owned data              | `204`                                                 |
| GET /v1/health        | Health probe (unauthenticated)  | `{ status, db }`                                      |

## Database Ownership

kebi (FastAPI) owns all database writes. Alembic in kebi owns all migrations. NestJS does not write to any database table.

FastAPI writes and reads:

- places, place_embeddings, user_places, taste_model
- interactions, user_memories

NestJS has no database write responsibilities. It reads nothing from the DB directly — all data it needs comes from kebi responses or Clerk.

## Technology Stack

| Layer           | Technology                 | Notes                            |
| --------------- | -------------------------- | -------------------------------- |
| Frontend        | Next.js + Tailwind CSS     | Server and client components     |
| Auth            | Clerk                      | Free tier, 50K MAU               |
| Backend         | NestJS                     | Modular architecture             |
| ORM             | —                          | NestJS has no DB writes; FastAPI owns all tables |
| Database        | PostgreSQL + pgvector      | Vector similarity search         |
| Package Manager | pnpm                       |                                  |
| Monorepo        | Nx                         | Workspace with module boundaries |
| Runtime         | Node 20 LTS               |                                  |
| Frontend Deploy | Vercel                     | Free Hobby tier                  |
| Backend Deploy  | Railway                    | Hobby $5/mo                      |
| Local Dev       | Docker Compose             | Not used in production           |

---

## Design Patterns

These are structural constraints that define how the system is layered.
They describe what lives where and what crosses which boundary.
Behavioral and implementation patterns live in docs/decisions.md.

### Facade — Controllers
Controllers are the HTTP entry point only. Each controller method
makes exactly one service call and returns the result. No TypeORM
repository calls, no kebi client calls, no business logic appear inside
any controller file. All orchestration lives in the service layer.
Guards and pipes via decorators do not count as logic inside the
method body.

### Interface — Swappable Dependencies
Any **swappable external** dependency lives behind a TypeScript interface.
Controllers and services import the interface only, injected via
NestJS dependency injection. No concrete swappable class is imported directly
in business logic. Concrete implementations live in their domain
module or in a shared provider if used across multiple modules.
`IdentityProvider` (Supabase today, swappable via config) is the reference
example. Internal infrastructure wrappers — `KebiHttpClient` over `HttpService`,
which has exactly one implementation — are injected concretely like
`HttpService`/`ConfigService`, not interfaced (ADR-047).

### Strategy — HTTP Transport (apps/web)
All HTTP calls from apps/web go through the HttpClient interface.
Concrete transports live in apps/web/src/api/transports/. Nothing
outside apps/web/src/api/ imports fetch or any HTTP library directly.
