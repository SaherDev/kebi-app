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
                              │ HTTP (JSON) POST /v1/chat
                              ▼
┌──────────────────────┐  ┌──────────────────────────┐
│  PostgreSQL           │  │  kebi (FastAPI)     │
│  + pgvector           │  │  - Classifies intent     │
│                       │  │  - Runs agent pipeline   │
│  FastAPI writes:      │  │  - Generates embeddings  │
│  - places             │  │  - Owns all DB writes    │
│  - embeddings         │  │                          │
│  - taste_model        │  │                          │
│  - consult_logs       │  │                          │
│  - user_memories      │  │                          │
│  - interaction_log    │  │                          │
└──────────────────────┘  └──────────────────────────┘
```

## What This Repo Owns

- All user-facing UI (Next.js)
- Authentication and authorization (Clerk)
- HTTP gateway: receives user messages, forwards to kebi via `POST /v1/chat`, returns the response

## What This Repo Does NOT Do

- Call LLM providers (OpenAI, Anthropic)
- Generate embeddings
- Run vector similarity search
- Call Google Places API
- Write place records or embeddings (FastAPI owns these)
- Touch Redis

## Data Flow: All User Interactions

All user messages — save, consult, recall — flow through a single endpoint (ADR-036):

1. User submits input in apps/web.
2. apps/web sends the message to services/api via `POST /api/v1/chat`.
3. services/api verifies auth (Clerk), then forwards to kebi via `POST /v1/chat` with user_id and message.
4. kebi classifies intent (save / consult / recall / assistant / clarification) and handles the full pipeline autonomously.
5. kebi returns a typed `ChatResponseDto` with a discriminated `type` field.
6. services/api returns HTTP 200 with the response. The frontend reads the `type` field to determine what happened.
7. apps/web renders the appropriate UI based on response type.

One HTTP call to kebi. Intent classification is the AI service's responsibility. NestJS never inspects response content — it forwards and returns. HTTP error codes (401, 403, 503) are reserved for transport failures only.

## Intent Classification

Classification happens in kebi as the first step of request handling — not in NestJS, not in the frontend.

Intent types returned in `type` field:
- `extract-place` — URL or place name was saved
- `consult` — natural language intent query was answered
- `recall` — memory fragment search was performed
- `assistant` — general assistant reply
- `clarification` — AI needs more information

Empty state rule: the system always returns something. At zero saves, a consult query returns nearby popular options. A recall with no matches returns the closest consult result with a note that nothing was found in saves. Never return a zero-result response.

## API Contract (NestJS to kebi)

| Endpoint       | Purpose                      | NestJS Sends                   | kebi Returns                    |
| -------------- | ---------------------------- | ------------------------------ | ------------------------------------ |
| POST /v1/chat  | All user interactions        | message, user_id, location?    | typed ChatResponseDto (discriminated union) |

See `docs/api-contract.md` for the full request/response schema.

## Database Ownership

kebi (FastAPI) owns all database writes. Alembic in kebi owns all migrations. NestJS does not write to any database table.

FastAPI writes and reads:

- places, embeddings, taste_model
- consult_logs, user_memories, interaction_log

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
repository calls, no AiServiceClient calls, no business logic appear inside
any controller file. All orchestration lives in the service layer.
Guards and pipes via decorators do not count as logic inside the
method body.

### Interface — Swappable Dependencies
Any external dependency lives behind a TypeScript interface.
Controllers and services import the interface only, injected via
NestJS dependency injection. No concrete class is imported directly
in business logic. Concrete implementations live in their domain
module or in a shared provider if used across multiple modules.
AiServiceClient is the reference example.

### Strategy — HTTP Transport (apps/web)
All HTTP calls from apps/web go through the HttpClient interface.
Concrete transports live in apps/web/src/api/transports/. Nothing
outside apps/web/src/api/ imports fetch or any HTTP library directly.
