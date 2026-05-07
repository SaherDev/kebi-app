# Data Model: Consult SSE Proxy

**Feature**: 001-consult-sse-proxy
**Phase**: 1 — Design

---

## No New Database Tables

This feature introduces no schema changes. The consult endpoint forwards to kebi and returns the response. SSE proxying is stateless pass-through.

---

## Shared Types (Source of Truth)

**File**: `libs/shared/src/lib/types.ts` — imported by both `apps/web` (`@kebi-app/shared`) and `services/api` DTOs

| Type | Fields | Consumed by |
|------|--------|-------------|
| `LocationCoordinates` | `lat: number, lng: number` | both |
| `PlaceResult` | `place_name, address, reasoning, source: PlaceSource` | both |
| `ReasoningStep` | `step: string, summary: string` | both |
| `ConsultRequest` | `query, location?, stream?` | both |
| `ConsultResponse` | `primary: PlaceResult, alternatives: PlaceResult[], reasoning_steps: ReasoningStep[]` | both |
| `SseStepEvent` | `type: 'step', step: string, summary: string` | apps/web |
| `SseResultEvent` | `type: 'result'` + ConsultResponse fields | apps/web |
| `SseEvent` | `SseStepEvent \| SseResultEvent` (discriminated union) | apps/web |

NestJS DTOs **implement** these interfaces and add `class-validator` decorators. No type duplication.

---

## DTO Definitions

### Frontend → NestJS Request

**File**: `services/api/src/consult/dto/consult-request.dto.ts` — `implements ConsultRequest`

| Field | Type | Validation | Notes |
|-------|------|------------|-------|
| `query` | `string` | required, maxLength 1000 | Raw user intent, forwarded as-is |
| `location.lat` | `number` | optional, min -90, max 90 | User's current latitude |
| `location.lng` | `number` | optional, min -180, max 180 | User's current longitude |
| `stream` | `boolean` | optional, default false | If true: SSE stream. If false/absent: synchronous JSON |

### NestJS → FastAPI Forwarded Request

**File**: `services/api/src/ai-service/dto/ai-consult-payload.dto.ts`

| Field | Type | Notes |
|-------|------|-------|
| `user_id` | `string` | Injected from Clerk auth token — never from frontend |
| `query` | `string` | Passed through from frontend request |
| `location` | `{ lat, lng }` | Optional, passed through |
| `stream` | `boolean` | Passed through to FastAPI |

### NestJS → Frontend Response (non-streaming)

**File**: `services/api/src/consult/dto/consult-response.dto.ts`

Mirrors the FastAPI response shape from `docs/api-contract.md`:

| Field | Type | Notes |
|-------|------|-------|
| `primary.place_name` | `string` | |
| `primary.address` | `string` | |
| `primary.reasoning` | `string` | |
| `primary.source` | `"saved" \| "discovered"` | |
| `alternatives` | `array` | Up to 2, same shape as primary |
| `reasoning_steps` | `array` | Each has `step` (string) and `summary` (string) |

All fields are `@IsOptional()` per ADR-019 (forward-compatible AI response DTOs).

### Streaming Events (SSE)

No DTO class — raw passthrough. FastAPI emits `text/event-stream` format:
```
data: {"type": "step", "step": "intent_parsing", "summary": "..."}
data: {"type": "result", "primary": {...}, "alternatives": [...]}
```
NestJS proxies each `data:` line as-is without parsing.

---

## Interface Definitions

### IAiServiceClient

**File**: `services/api/src/ai-service/ai-service-client.interface.ts`

```typescript
import { Readable } from 'stream';

export interface AiConsultPayload {
  user_id: string;
  query: string;
  location?: { lat: number; lng: number };
  stream?: boolean;
}

export interface AiPlaceResult {
  place_name: string;
  address: string;
  reasoning: string;
  source: 'saved' | 'discovered';
}

export interface AiReasoningStep {
  step: string;
  summary: string;
}

export interface AiConsultResponse {
  primary: AiPlaceResult;
  alternatives: AiPlaceResult[];
  reasoning_steps: AiReasoningStep[];
}

export interface IAiServiceClient {
  consult(payload: AiConsultPayload): Promise<AiConsultResponse>;
  consultStream(payload: AiConsultPayload): Promise<Readable>;
}

export const AI_SERVICE_CLIENT = Symbol('IAiServiceClient');
```

---

## State Transitions

### Streaming Request Lifecycle

```
Browser POST /api/v1/consult (stream: true)
  → ClerkMiddleware (auth)
  → AiEnabledGuard (ai_enabled check)
  → ConsultController.handle()
  → ConsultService.handle(userId, dto, req, res)
      → res.setHeader(SSE headers)
      → res.flushHeaders()
      → AiServiceClient.consultStream(payload) → Readable
      → req.on('close') → upstream.destroy()
      → stream.pipeline(upstream, res, cleanup)
  → [events flow token-by-token to browser]
  → [upstream ends] → pipeline closes res

Browser POST /api/v1/consult (stream: false/absent)
  → ClerkMiddleware (auth)
  → AiEnabledGuard (ai_enabled check)
  → ConsultController.handle()
  → ConsultService.handle(userId, dto, req, res)
      → AiServiceClient.consult(payload) → AiConsultResponse
      → res.json(response)
```
