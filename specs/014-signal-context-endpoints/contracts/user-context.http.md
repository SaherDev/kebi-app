# Contract: `GET /api/v1/user/context`

Gateway endpoint. Authenticates, reads `user_id` from the Clerk token, forwards to FastAPI `GET /v1/user/context?user_id=<clerkId>`.

## Auth

- Clerk bearer token required (handled by `ClerkMiddleware`, global).
- `@RequiresAi()` guard (ADR-022): rejects with 503 if global kill switch is on, 403 if user has `ai_enabled: false`.

## Request

```http
GET /api/v1/user/context HTTP/1.1
Authorization: Bearer <clerk-jwt>
```

No request body. No request query parameters from the caller. The Clerk user ID is extracted by the gateway via `@CurrentUser()` and forwarded as a query param to FastAPI.

## Forward-to-FastAPI URL

```
GET ${AI_SERVICE_BASE_URL}/v1/user/context?user_id=<clerkId>
```

Timeout 30 s.

## Responses

### 200 OK (populated)

```json
{
  "saved_places_count": 12,
  "chips": [
    {
      "label": "Japanese",
      "source_field": "subcategory",
      "source_value": "japanese",
      "signal_count": 5
    },
    {
      "label": "Thai",
      "source_field": "subcategory",
      "source_value": "thai",
      "signal_count": 3
    }
  ]
}
```

### 200 OK (cold start)

```json
{
  "saved_places_count": 0,
  "chips": []
}
```

### Error responses

| Status | Body | When |
|--------|------|------|
| `401 Unauthorized` | Clerk-middleware body | No/invalid bearer token |
| `403 Forbidden` | `AiEnabledGuard` body | `user.ai_enabled === false` |
| `503 Service Unavailable` | Standard filter body | Global kill switch; FastAPI 5xx; network error/timeout |

Note: no 404 is expected from FastAPI for this endpoint — a valid Clerk user always has *some* state (possibly empty).

## Success Criteria traceability

- FR-012 → Clerk + `@RequiresAi()` guard.
- FR-013 → no request body accepted; `user_id` is extracted, not submitted.
- FR-014 → forwarded via `IAiServiceClient.getUserContext(userId)`; query param `?user_id=…`.
- FR-015 / FR-016 → response shape matches `UserContextResponse` type in `libs/shared`.
- FR-017 → controller body is one line: `return this.userContextService.get(userId)`.
- FR-018 → cold-start user receives `{ saved_places_count: 0, chips: [] }` (FastAPI already returns this).

## Bruno file

`kebi-config/bruno/nestjs-api/user-context.bru` — single GET request with expected response examples for both populated and cold-start states.
