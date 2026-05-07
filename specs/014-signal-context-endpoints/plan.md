# Implementation Plan: Signal & User Context Gateway Endpoints

**Branch**: `014-signal-context-endpoints` | **Date**: 2026-04-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-signal-context-endpoints/spec.md`

## Summary

Three gateway-level additions to `services/api`, all pure pass-through to `kebi` via the existing `AiServiceClient`:

1. **Consult response carries `recommendation_id`** — widen `ConsultResponseData` in `libs/shared` to include `recommendation_id: string | null`. No NestJS code change required beyond the type (the current chat pipeline is already shape-opaque over `data`).
2. **`POST /api/v1/signal`** — new module (`SignalModule`) with facade controller, service, and discriminated-union DTO. Forwards `{ signal_type, user_id, recommendation_id, place_id }` to FastAPI's `POST /v1/signal` via a new `IAiServiceClient.postSignal()` method.
3. **`GET /api/v1/user/context`** — new module (`UserContextModule`) with facade controller, service, and response DTO. Forwards via a new `IAiServiceClient.getUserContext(userId)` method that calls `GET /v1/user/context?user_id=…`.

Both new endpoints apply `@RequiresAi()` (ADR-022) for uniform kill-switch policy. Error translation reuses the existing `AllExceptionsFilter` (ADR-018) — which already passes AI-service 404 through unchanged (the spec's "extend" wording is corrected to "confirm" in research).

## Technical Context

**Language/Version**: TypeScript 5.x / Node 20 LTS
**Primary Dependencies**: NestJS 11 (`@nestjs/common`, `@nestjs/axios`, `@nestjs/config`), `class-validator`, `class-transformer`, `@clerk/backend`, `rxjs`
**Storage**: N/A — this feature is a stateless gateway pass-through. No TypeORM entity, migration, or DB query changes. Constitution §V preserved.
**Testing**: Jest (unit) + Supertest (e2e). Follow existing patterns in `ai-service.client.spec.ts`, `clerk.middleware.spec.ts`, `ai-enabled.guard.spec.ts`.
**Target Platform**: Node 20 LTS on Railway (production) and macOS (local dev).
**Project Type**: Nx monorepo — `services/api` (NestJS thin gateway) + `libs/shared` (TypeScript DTOs).
**Performance Goals**: `/signal` ≤ 2 s p95, `/user/context` ≤ 2 s p95 under normal AI-service load. Timeout cap 30 s (reuse of `AiServiceClient.chat()` convention).
**Constraints**: No DB writes; no direct `fetch`/`axios` in controllers or services; no response transformation (pure pass-through); all new endpoints represented by Bruno `.bru` files.
**Scale/Scope**: Two new controllers (≤ 30 LOC each), two new services (≤ 20 LOC each), two `AiServiceClient` methods, two response type definitions in `libs/shared`, one Bruno file per endpoint.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| § | Constitution principle | Compliance | Notes |
|---|------------------------|-----------|-------|
| I | Two-Repo Boundary | ✅ | No LLM/embedding/vector/Places/Redis. Pure forwarding. |
| II | Nx Module Boundaries | ✅ | `services/api` imports only `libs/shared`. `libs/shared` adds types, imports nothing. |
| III | ADRs are constraints | ✅ | ADR-013 (Clerk middleware), ADR-016/036 (AiServiceClient), ADR-017 (global ValidationPipe), ADR-018 (AllExceptionsFilter), ADR-019 (forward-compatible DTOs), ADR-021 (Bruno, no Swagger), ADR-022 (`@RequiresAi()`), ADR-023 (@Serialize for controllers), ADR-032 (controllers as facades), ADR-033 (interface-first DI), ADR-014 (one module per domain). All followed. |
| IV | Configuration | ✅ | No new config keys. Reuses `AI_SERVICE_BASE_URL`. |
| V | Database Write Ownership | ✅ | Zero NestJS writes. Recommendation rows are FastAPI's domain. |
| VI | AI Service Contract | ✅ | Adds two methods to `IAiServiceClient`. Timeout 30 s reused. DTOs remain forward-compatible (ADR-019). |
| VII | Frontend Standards | N/A | Frontend wiring is out of scope per spec. |
| VIII | Code Standards | ✅ | kebab-case files, PascalCase DTOs with `Dto` suffix, shared types in `libs/shared`, no barrel exports from apps. |
| IX | Git & Commits | ✅ | Branch `014-signal-context-endpoints` from `dev`. Conventional commits planned with scope `api`/`shared`. Bruno `.bru` files will accompany both new endpoints. |
| X | Required Skills Per Domain | ✅ | `nestjs-expert` invoked before this plan (per constitution). |

**Gate result**: PASS. No Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/014-signal-context-endpoints/
├── plan.md              # This file
├── spec.md              # Feature spec (from /speckit.specify and /speckit.clarify)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (interface snapshots + wire schemas)
│   ├── ai-service-client.ts
│   ├── signal.http.md
│   └── user-context.http.md
├── checklists/
│   └── requirements.md  # From /speckit.specify
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root — Nx monorepo, backend-only scope for this feature)

```text
services/api/
├── src/
│   ├── ai-service/
│   │   ├── ai-service-client.interface.ts   # EXTEND — add postSignal, getUserContext
│   │   ├── ai-service.client.ts             # EXTEND — implementations
│   │   ├── ai-service.client.spec.ts        # EXTEND — unit tests for new methods
│   │   └── ai-service.module.ts             # unchanged
│   ├── signal/                              # NEW
│   │   ├── signal.module.ts
│   │   ├── signal.controller.ts
│   │   ├── signal.controller.spec.ts
│   │   ├── signal.service.ts
│   │   ├── signal.service.spec.ts
│   │   └── dto/
│   │       ├── signal-request.dto.ts        # discriminated-union body validation
│   │       └── signal-response.dto.ts       # @Serialize target, { status: string }
│   ├── user-context/                        # NEW
│   │   ├── user-context.module.ts
│   │   ├── user-context.controller.ts
│   │   ├── user-context.controller.spec.ts
│   │   ├── user-context.service.ts
│   │   └── dto/
│   │       └── user-context-response.dto.ts # @Serialize target
│   ├── chat/                                # unchanged — response type widens via libs/shared
│   ├── common/
│   │   ├── decorators/{current-user, requires-ai}.decorator.ts   # unchanged
│   │   ├── guards/ai-enabled.guard.ts                            # unchanged
│   │   ├── middleware/clerk.middleware.ts                        # unchanged
│   │   └── filters/all-exceptions.filter.ts                      # UNCHANGED — already passes 404 through
│   └── app/
│       └── app.module.ts                    # EXTEND — register SignalModule + UserContextModule
└── config/app.yaml                          # unchanged

libs/shared/src/lib/
└── types.ts                                 # EXTEND — widen ConsultResponseData, add UserContextResponse + SignalRequest + SignalResponse

kebi-config/bruno/nestjs-api/              # NEW bruno files for both endpoints
├── signal.bru                               # NEW — two example requests (accepted + rejected)
└── user-context.bru                         # NEW
```

**Structure Decision**: Nx monorepo, backend-scoped. One NestJS module per new domain (`signal/`, `user-context/`) per ADR-014. Shared DTOs live in `libs/shared` per Constitution §II. No changes to `apps/web` or `libs/ui`.

## Phase 0 artifacts

See [research.md](./research.md) — resolves the filter-extension question (not needed, already works), confirms `recommendation_id` nullability handling in the type, and documents the interface-extension approach for `IAiServiceClient`.

## Phase 1 artifacts

- [data-model.md](./data-model.md) — entity definitions, field-level typing, validation rules
- [contracts/ai-service-client.ts](./contracts/ai-service-client.ts) — post-change shape of the `IAiServiceClient` interface
- [contracts/signal.http.md](./contracts/signal.http.md) — `POST /api/v1/signal` HTTP contract
- [contracts/user-context.http.md](./contracts/user-context.http.md) — `GET /api/v1/user/context` HTTP contract
- [quickstart.md](./quickstart.md) — end-to-end manual test flow using Bruno

## Complexity Tracking

*No entries — Constitution Check passed without violations.*
