# Implementation Plan: AI Service Client — Migrate to Axios and Add extractPlace

**Branch**: `001-ai-service-axios` | **Date**: 2026-03-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-ai-service-axios/spec.md`

## Summary

Migrate `AiServiceClient` from `node:http`/`node:https` to NestJS `HttpModule` (Axios) per ADR-016. Add `extractPlace()` method to both `IAiServiceClient` interface and `AiServiceClient` implementation. Add types `AiExtractPlacePayload` and `AiExtractPlaceResponse` matching `docs/api-contract.md` exactly. Update existing tests to mock `HttpService` in the constructor.

## Technical Context

**Language/Version**: TypeScript 5.x / Node 20 LTS
**Primary Dependencies**: NestJS 11, `@nestjs/axios` (to install), `rxjs` 7.8.0 (installed), `axios` (peer of @nestjs/axios)
**Storage**: N/A — no database changes
**Testing**: Jest via `@nestjs/testing` (installed)
**Target Platform**: Railway (NestJS service)
**Project Type**: NestJS module refactoring (internal, no new routes)
**Performance Goals**: 10s timeout for extract-place, 20s timeout for consult (per ADR-016 + Constitution VI)
**Constraints**: No call-site changes — facade pattern preserved; no `node:http`/`node:https` imports after change
**Scale/Scope**: 3 files modified, 1 test file updated, 1 package installed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| NestJS stays thin gateway (Constitution I) | PASS | Client only forwards HTTP — no AI logic, no Redis, no LLM calls |
| Nx module boundaries respected (Constitution II) | PASS | All changes within `services/api/src/ai-service/` |
| ADR-016 mandates HttpModule/Axios | PASS | This task implements ADR-016 exactly |
| ADR-014: one module per domain | PASS | `AiServiceModule` already exists; no new modules added |
| ADR-033: interface-first DI | PASS | `IAiServiceClient` updated first; callers inject interface |
| Config via ConfigService (ADR-012) | PASS | `base_url` read via `ConfigService` — unchanged |
| No hardcoded values (Constitution IV) | PASS | Timeout values are named constants in implementation |
| No new `.env` files (Constitution IV) | PASS | Package install only; no secrets involved |

**Spec timeout discrepancy** (to correct during implementation): `spec.md` FR-007 says "30s for consult" — this contradicts ADR-016 (20s) and Constitution Section VI (20s). The implementation uses 20s. The spec FR-007 will be corrected as part of this plan.

**Post-design constitution re-check**: All gates pass. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-service-axios/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code (affected files)

```text
services/api/
├── package.json                                         ← add @nestjs/axios
└── src/
    └── ai-service/
        ├── ai-service-client.interface.ts               ← add 3 types + extractPlace()
        ├── ai-service.client.ts                         ← migrate transport, add extractPlace()
        ├── ai-service.module.ts                         ← register HttpModule
        └── ai-service.client.spec.ts                    ← update mocks, add extractPlace tests
```

**Structure Decision**: Single-project, backend only. All changes are within the existing `ai-service` domain module. No new modules, controllers, or services introduced.

## Complexity Tracking

No constitution violations. No complexity justification needed.

---

## Phase 0: Research

**Status**: COMPLETE — see [research.md](./research.md)

| Unknown | Resolution |
|---------|-----------|
| `@nestjs/axios` installed? | No — install via `pnpm --filter @kebi-app/api add @nestjs/axios axios` |
| Observable → Promise bridge? | `firstValueFrom()` from rxjs 7 |
| Streaming with Axios? | `responseType: 'stream'` → `response.data` is `Readable` |
| Consult timeout? | 20s per ADR-016 + Constitution VI (spec FR-007 is incorrect — correct to 20s) |
| Error shape for non-2xx? | Pass-through — `AxiosError` propagates raw; `AllExceptionsFilter` (ADR-018) handles it in a subsequent task |
| Existing tests break? | Yes — `new AiServiceClient(configService)` becomes `new AiServiceClient(configService, httpService)` |

---

## Phase 1: Design & Contracts

**Status**: COMPLETE

### Interface Changes (ai-service-client.interface.ts)

Three types to add before the `IAiServiceClient` interface:

```typescript
export interface AiExtractedPlace {
  place_name: string | null;
  address: string | null;
  cuisine: string | null;
  price_range: string | null;
}

export interface AiExtractPlacePayload {
  user_id: string;
  raw_input: string;
}

export interface AiExtractPlaceResponse {
  place_id: string | null;
  place: AiExtractedPlace;
  confidence: number;
  status: 'resolved' | 'unresolved';
  requires_confirmation: boolean;
  source_url: string | null;
}
```

`IAiServiceClient` gains one method:

```typescript
extractPlace(payload: AiExtractPlacePayload): Promise<AiExtractPlaceResponse>;
```

### Module Change (ai-service.module.ts)

Add `HttpModule` import from `@nestjs/axios`:

```typescript
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [ConfigModule, HttpModule],
  ...
})
```

### Client Change (ai-service.client.ts)

Constructor changes:
- Remove `node:http`, `node:https`, `node:url`, `stream` imports
- Add `HttpService` from `@nestjs/axios`
- Add `firstValueFrom` from `rxjs`
- Inject `HttpService` as second constructor parameter

No `normalizeError()` helper. Error handling decision: **Option B — pass-through**. `AxiosError` propagates raw from all three methods. No try/catch for HTTP errors — Axios throws on non-2xx and the error reaches callers unmodified. The `AllExceptionsFilter` (ADR-018) will handle `AxiosError` in a subsequent task.

Method implementations:
- `consult()` — `firstValueFrom(httpService.post('/v1/consult', payload, { timeout: 20000 }))` → return `response.data`
- `consultStream()` — `firstValueFrom(httpService.post('/v1/consult', payload, { timeout: 20000, responseType: 'stream' }))` → return `response.data` (which is `Readable`)
- `extractPlace()` — `firstValueFrom(httpService.post('/v1/extract-place', payload, { timeout: 10000 }))` → return `response.data`

No wrapping try/catch in any method. Axios network errors (connection refused, timeout) also propagate raw.

### Test Change (ai-service.client.spec.ts)

- Add `HttpService` import from `@nestjs/axios`
- Add `of` import from `rxjs`
- Add `mockHttpService` object with `post: jest.fn()` to each `beforeEach`
- Pass `mockHttpService` as second argument to `new AiServiceClient(configService, mockHttpService)`
- Add `extractPlace()` describe block checking method existence
- Add unit test verifying `AxiosError` propagates raw (no wrapping) when `post` throws
- Add unit test for method existence of `extractPlace()`

### No Contracts Folder

This feature introduces no new external-facing HTTP routes or public API changes. The `contracts/` directory is not applicable — `extractPlace()` is an internal method call from domain services, not a new endpoint.

### Spec Correction

FR-007 in `spec.md` incorrectly states 30s for consult. It will be corrected to 20s to align with ADR-016 and Constitution VI. This is a documentation fix, not a functional deviation.

---

## Verification Checklist

Run after implementation:

```bash
pnpm nx test api           # All tests pass (including updated spec)
pnpm nx lint api           # Zero lint errors
grep -r "node:http\|node:https" services/api/src/ai-service/  # Returns nothing
```

Expected outcomes:
- `pnpm nx test api` — zero failures
- `pnpm nx lint api` — zero errors/warnings in changed files
- No `node:http` or `node:https` imports in `ai-service/` directory
- TypeScript compilation reports zero errors in `ai-service/`
