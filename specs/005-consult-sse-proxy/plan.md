# Implementation Plan: Consult SSE Proxy

**Branch**: `001-consult-sse-proxy` | **Date**: 2026-03-17 | **Spec**: [spec.md](./spec.md)

## Summary

Add a `ConsultModule` to `services/api` that handles `POST /api/v1/consult` in two modes:
- **Non-streaming** (`stream: false`/absent): forwards to FastAPI, returns synchronous JSON
- **Streaming** (`stream: true`): forwards to FastAPI, proxies the SSE stream token-by-token to the browser

Implements the first concrete `AiServiceClient` (ADR-016) using Node's built-in `http`/`https` module. Interface-first per ADR-033. Controller is a pure facade (ADR-032). Disconnect cleanup via `req.on('close')` + `stream.pipeline()`.

---

## Technical Context

**Language/Version**: TypeScript 5.x / Node 20 LTS
**Primary Dependencies**: NestJS 11, `@nestjs/platform-express`, Node built-in `http`/`https` (no new packages)
**Storage**: N/A (no new DB tables; recommendations history write is deferred to future task)
**Testing**: Jest + `@nestjs/testing` (unit tests with mocked IAiServiceClient)
**Target Platform**: Railway (NestJS service behind nginx reverse proxy)
**Project Type**: Web service (NestJS backend module)
**Performance Goals**: SSE events forwarded within 200ms of FastAPI producing them
**Constraints**: `stream.pipeline()` required (not `.pipe()`); backpressure handling required; client disconnect must clean up upstream
**Scale/Scope**: Single endpoint, two code paths, one new module + one new shared module

---

## Constitution Check

| Rule | Check | Result |
|------|-------|--------|
| ADR-009: SSE is the planned streaming mode | This feature IS the SSE implementation | ✅ |
| Shared types rule: no duplication across apps | `ConsultRequest/Response` in `libs/shared`; DTOs implement interfaces | ✅ |
| ADR-014: One module per domain | `ConsultModule` + `AiServiceModule` — separate domains | ✅ |
| ADR-016: AiServiceClient for all forwarding | `AiServiceClient` created here as first implementation | ✅ |
| ADR-017: Global ValidationPipe | `ConsultRequestDto` uses class-validator decorators | ✅ |
| ADR-021: Bruno file for each endpoint | `consult-stream.bru` added to `nestjs-api/` | ✅ |
| ADR-032: Controller = facade | Controller makes one call: `service.handle(userId, dto, req, res)` | ✅ |
| ADR-033: Interface before concrete class | `IAiServiceClient` defined before `AiServiceClient` | ✅ |
| ADR-022: AiEnabledGuard on AI endpoints | `@RequiresAi()` on ConsultController | ✅ |
| ADR-003: Non-secret config in YAML | `ai_service.base_url` added to `.local.yaml` | ✅ |
| Nx boundary: services/api → libs/shared only | No ui or web imports | ✅ |

---

## Project Structure

### Documentation (this feature)

```text
specs/001-consult-sse-proxy/
├── plan.md              ← this file
├── spec.md
├── research.md          ← Phase 0 ✓
├── data-model.md        ← Phase 1 ✓
├── contracts/
│   └── consult-endpoint.md  ← Phase 1 ✓
└── tasks.md             ← Phase 2 (/speckit.tasks — not yet created)
```

### Source Code Layout

```text
libs/shared/src/lib/
└── types.ts                     ← ADD: ConsultRequest, ConsultResponse, PlaceResult,
                                         ReasoningStep, LocationCoordinates, SseEvent

services/api/
├── config/
│   └── .local.yaml              ← ADD: ai_service.base_url
├── src/
│   ├── ai-service/              ← NEW MODULE
│   │   ├── ai-service.module.ts
│   │   ├── ai-service-client.interface.ts   (IAiServiceClient + Symbol token)
│   │   ├── ai-service.client.ts             (AiServiceClient — Node http/https)
│   │   └── dto/
│   │       └── ai-consult-payload.dto.ts    (what NestJS sends to FastAPI)
│   ├── consult/                 ← NEW MODULE
│   │   ├── consult.module.ts
│   │   ├── consult.controller.ts
│   │   ├── consult.service.ts
│   │   └── dto/
│   │       ├── consult-request.dto.ts       (frontend request incl. stream?)
│   │       └── consult-response.dto.ts      (non-streaming response)
│   └── app/
│       └── app.module.ts        ← MODIFY: import ConsultModule
kebi-config/bruno/
└── nestjs-api/
    └── consult-stream.bru       ← NEW Bruno request file
```

---

## Implementation Phases

### Phase 0 — Shared Types in libs/shared (first)

**Goal**: Add consult request/response types to `libs/shared` so both `apps/web` and `services/api` share the same contract. No class-validator decorators here — pure TypeScript interfaces only.

**Files**:
- [ ] `libs/shared/src/lib/types.ts` (extend existing)
  - `LocationCoordinates: { lat: number; lng: number }`
  - `PlaceResult: { place_name: string; address: string; reasoning: string; source: PlaceSource }`
  - `ReasoningStep: { step: string; summary: string }`
  - `ConsultRequest: { query: string; location?: LocationCoordinates; stream?: boolean }`
  - `ConsultResponse: { primary: PlaceResult; alternatives: PlaceResult[]; reasoning_steps: ReasoningStep[] }`
  - `SseStepEvent: { type: 'step'; step: string; summary: string }` (streaming event — step)
  - `SseResultEvent: { type: 'result' } & ConsultResponse` (streaming event — final result)
  - `SseEvent: SseStepEvent | SseResultEvent` (discriminated union for frontend to switch on)

**Usage after this phase**:
- `apps/web` imports `ConsultRequest`, `ConsultResponse`, `SseEvent` from `@kebi-app/shared`
- `services/api` DTOs implement these interfaces + add class-validator decorators

**Verification**: `pnpm nx build shared && pnpm nx lint shared`

---

### Phase 1 — AiServiceModule (foundation)

**Goal**: Create the `AiServiceModule` with `IAiServiceClient` interface and `AiServiceClient` implementation. No consult-specific logic yet.

**Files**:
- [ ] `services/api/src/ai-service/ai-service-client.interface.ts`
  - Define `IAiServiceClient` with `consult()` and `consultStream()` methods
  - Types `AiConsultPayload` (adds `user_id`) and `AiConsultResponse` reference `@kebi-app/shared` types
  - Export `AI_SERVICE_CLIENT` injection token (Symbol)
- [ ] `services/api/src/ai-service/ai-service.client.ts`
  - Implements `IAiServiceClient`
  - Uses `node:http`/`node:https` (parse base URL to choose)
  - `consult()`: makes POST to `/v1/consult`, collects body, parses JSON
  - `consultStream()`: makes POST to `/v1/consult` with `stream: true`, returns `IncomingMessage` (Readable)
  - Base URL from `ConfigService.get<string>('ai_service.base_url')`
  - Timeouts: 20s for consult (per api-contract.md)
- [ ] `services/api/src/ai-service/ai-service.module.ts`
  - Provides `AiServiceClient` under `AI_SERVICE_CLIENT` token
  - Exports `AI_SERVICE_CLIENT` token
- [ ] `services/api/config/.local.yaml`
  - Add `ai_service.base_url: http://localhost:8000`

**Verification**: `pnpm nx build api` (typecheck only — no controller to test yet)

---

### Phase 2 — ConsultModule (non-streaming first)

**Goal**: Create the full `ConsultModule` with non-streaming path working end-to-end.

**Files**:
- [ ] `services/api/src/consult/dto/consult-request.dto.ts`
  - `implements ConsultRequest` from `@kebi-app/shared`
  - `query: string` — `@IsString() @IsNotEmpty() @MaxLength(1000)`
  - `location?: LocationCoordinates` — `@IsOptional() @ValidateNested() @Type(() => LocationDto)`
  - `stream?: boolean` — `@IsOptional() @IsBoolean()`
- [ ] `services/api/src/consult/dto/consult-response.dto.ts`
  - `implements ConsultResponse` from `@kebi-app/shared`
  - `primary: PlaceResultDto` — `@IsOptional()`
  - `alternatives: PlaceResultDto[]` — `@IsOptional()`
  - `reasoning_steps: ReasoningStepDto[]` — `@IsOptional()`
  - (All optional per ADR-019 — forward-compatible AI response)
- [ ] `services/api/src/consult/consult.service.ts`
  - Injects `IAiServiceClient` via `@Inject(AI_SERVICE_CLIENT)`
  - `handle(userId, dto, req, res)` method:
    - Non-streaming: calls `aiClient.consult(payload)`, calls `res.json(result)`
    - Streaming: sets SSE headers, calls `aiClient.consultStream(payload)`, pipelines stream
- [ ] `services/api/src/consult/consult.controller.ts`
  - `@Post()` with `@Res({ passthrough: false })` and `@Req()`
  - `@RequiresAi()` decorator applied (ADR-022 — AiEnabledGuard for all AI endpoints)
  - One call: `await this.consultService.handle(user.id, dto, req, res)`
  - No response returned (void) — service owns the response
- [ ] `services/api/src/consult/consult.module.ts`
  - Imports `AiServiceModule`
  - Provides `ConsultService`
  - Declares `ConsultController`
- [ ] `services/api/src/app/app.module.ts`
  - Import `ConsultModule`

**Verification**: `pnpm nx test api` — unit tests for non-streaming path

---

### Phase 3 — Streaming Path

**Goal**: Add streaming mode to `ConsultService` + verify disconnect cleanup and backpressure.

**Files**:
- [ ] `services/api/src/consult/consult.service.ts` (streaming addition)
  - When `dto.stream === true`:
    - `res.setHeader('Content-Type', 'text/event-stream')`
    - `res.setHeader('Cache-Control', 'no-cache')`
    - `res.setHeader('X-Accel-Buffering', 'no')`
    - `res.flushHeaders()`
    - `const upstream = await this.aiClient.consultStream(payload)`
    - `req.on('close', () => upstream.destroy())`
    - Backpressure loop: check `res.write()` return; if false, `upstream.pause()`; resume on `res.drain`
    - `stream.pipeline(upstream, res, (err) => { if (err && !res.writableEnded) res.end() })`

**Verification**: Manual test with Bruno streaming request + browser EventSource

---

### Phase 4 — Tests + Bruno File

**Goal**: Unit tests passing, Bruno file committed.

**Files**:
- [ ] `services/api/src/consult/consult.service.spec.ts`
  - Mock `IAiServiceClient`
  - Test: non-streaming → calls `aiClient.consult()`, calls `res.json()`
  - Test: streaming → sets SSE headers, calls `aiClient.consultStream()`, calls `res.flushHeaders()`
  - Test: disconnect → `req.close` triggers `upstream.destroy()`
- [ ] `services/api/src/consult/consult.controller.spec.ts`
  - Mock `ConsultService`
  - Test: extracts userId from `req.user`, passes dto to service
- [ ] `services/api/src/ai-service/ai-service.client.spec.ts`
  - `jest.spyOn(http, 'request')` to mock node http (no nock dep needed)
  - Test: `consult()` collects body chunks and parses JSON response
  - Test: `consultStream()` returns a Readable stream
- [ ] `kebi-config/bruno/nestjs-api/consult-stream.bru`
  - Two examples: non-streaming and streaming variants

**Verification**: `pnpm nx test api && pnpm nx lint api`

---

## Verify Commands

```bash
pnpm nx build shared                # Shared types typecheck (run first)
pnpm nx build api                   # TypeScript typecheck
pnpm nx test api                    # All unit tests
pnpm nx lint api                    # ESLint (no inline disables)
pnpm nx affected -t test,lint       # Full affected check (shared + api + web)
```

**Done when**:
- [ ] `POST /api/v1/consult` with `stream: true` proxies SSE from FastAPI to browser
- [ ] `POST /api/v1/consult` without `stream` returns synchronous JSON unchanged
- [ ] Client disconnect terminates upstream FastAPI connection
- [ ] `pnpm nx test api` passes
- [ ] `pnpm nx lint api` passes
- [ ] `kebi-config/bruno/nestjs-api/consult-stream.bru` committed
