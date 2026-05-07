# Contract: `POST /api/v1/signal`

Gateway endpoint. Authenticates, injects `user_id`, forwards to FastAPI `POST /v1/signal`.

## Auth

- Clerk bearer token required (handled by `ClerkMiddleware`, global).
- `@RequiresAi()` guard (ADR-022): rejects with 503 if global kill switch is on, 403 if user has `ai_enabled: false`.

## Request

```http
POST /api/v1/signal HTTP/1.1
Authorization: Bearer <clerk-jwt>
Content-Type: application/json

{
  "signal_type": "recommendation_accepted",
  "recommendation_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "place_id": "google:ChIJN1t_tDeuEmsRUsoyG83frY4"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `signal_type` | `"recommendation_accepted" \| "recommendation_rejected"` | Yes | `@IsIn([...])` |
| `recommendation_id` | string | Yes | `@IsString() @IsNotEmpty()` |
| `place_id` | string | Yes | `@IsString() @IsNotEmpty()` |

No other fields accepted (`forbidNonWhitelisted: true`).

## Forward-to-FastAPI payload

The gateway enriches the body with `user_id` from the Clerk token:

```json
{
  "signal_type": "recommendation_accepted",
  "user_id": "user_3AhqBhtLzKKlbKrjVNGTHro1o76",
  "recommendation_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "place_id": "google:ChIJN1t_tDeuEmsRUsoyG83frY4"
}
```

Upstream URL: `${AI_SERVICE_BASE_URL}/v1/signal`. Timeout 30 s.

## Responses

| Status | Body | When |
|--------|------|------|
| `202 Accepted` | `{ "status": "accepted" }` (pass-through from FastAPI) | Happy path |
| `400 Bad Request` | `class-validator` error body | Missing or invalid field; unknown field present |
| `401 Unauthorized` | Clerk-middleware error body | No/invalid bearer token |
| `403 Forbidden` | `AiEnabledGuard` error body | `user.ai_enabled === false` |
| `404 Not Found` | `{ "detail": "Recommendation not found" }` (pass-through) | FastAPI did not find `recommendation_id` |
| `503 Service Unavailable` | Standard filter body | Global kill switch; FastAPI 5xx; network error/timeout |

## Success Criteria traceability

- FR-004 → Clerk + `@RequiresAi()` guard.
- FR-005 → `@IsIn()` validation.
- FR-006 → `@IsNotEmpty()` validation.
- FR-007 → `user_id` is never in the request body; always injected server-side.
- FR-008 → forwarded via `IAiServiceClient.postSignal()`; no `fetch`/`axios` import in controller or service.
- FR-009 → status 202; body is pass-through from FastAPI.
- FR-010 → 404 surfaces via existing `AllExceptionsFilter` pass-through (no filter edit).
- FR-011 → controller body is one line: `return this.signalService.submit(userId, dto)`.

## Bruno file

`kebi-config/bruno/nestjs-api/signal.bru` — two requests inside:
1. `Signal — Accepted` (`signal_type: recommendation_accepted`)
2. `Signal — Rejected` (`signal_type: recommendation_rejected`)
3. (Optional) `Signal — Bogus Recommendation ID` for the 404 path.
