# Contract: POST /api/v1/recall

**Direction**: Frontend → NestJS → kebi
**Branch**: `009-recall-proxy`
**Source of truth**: `docs/api-contract.md`

---

## Frontend → NestJS

**Endpoint**: `POST /api/v1/recall`

**Request**:
```json
{
  "query": "that ramen place I saved from TikTok",
  "user_id": "user_2abc123"
}
```

| Field   | Type   | Required | Constraints      |
|---------|--------|----------|------------------|
| query   | string | ✓        | max 500 chars    |
| user_id | string | ✓        | non-empty string |

**Success Response** (200 OK):
```json
{
  "results": [
    {
      "place_id": "550e8400-e29b-41d4-a716-446655440000",
      "place_name": "Fuji Ramen",
      "address": "123 Sukhumvit Soi 33, Bangkok",
      "cuisine": "ramen",
      "price_range": "low",
      "source_url": "https://www.tiktok.com/@foodie/video/123",
      "match_reason": "Saved from TikTok, tagged ramen",
      "saved_at": "2026-02-12T14:30:00Z"
    }
  ],
  "total": 1
}
```

**Error Responses**:

| Status | Trigger | Body |
|--------|---------|------|
| 400 | Missing/invalid `query` or `user_id` | `{ "statusCode": 400, "message": [...validation errors...] }` |
| 503 | kebi unreachable or 5xx | `{ "statusCode": 503, "message": "service temporarily unavailable, please retry" }` |
| 422 | kebi returns 422 | `{ "statusCode": 422, "message": "couldn't understand your request" }` |

---

## NestJS → kebi (forwarded as-is)

**Endpoint**: `POST /v1/recall` (at `ai_service.base_url`)

**Request** (same as frontend request body):
```json
{
  "user_id": "user_2abc123",
  "query": "that ramen place I saved from TikTok"
}
```

**Timeout**: 20 seconds

**Response**: Forwarded directly to caller without transformation.

---

## Implementation Notes

- NestJS does NOT transform the request or response
- `AllExceptionsFilter` handles AxiosError → 503 automatically
- The `query` → `user_id` field order in the forwarded body does not matter (JSON objects are unordered)
- `saved_at` is optional in the response — DTOs use `@IsOptional()` for all AI response fields (Constitution §VI)
