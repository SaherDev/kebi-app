# API Contract: POST /api/v1/places/extract

**Feature**: 002-extract-place-api
**Route**: `POST /api/v1/places/extract`
**Auth**: Required (Clerk bearer token)
**Guard**: `@RequiresAi()` (AI must be enabled for this user)

---

## Request

**Headers:**
```
Authorization: Bearer <clerk_jwt>
Content-Type: application/json
```

**Body:**
```json
{
  "raw_input": "https://www.tiktok.com/@foodie/video/123 amazing ramen shop"
}
```

| Field | Type | Required | Max Size | Description |
|---|---|---|---|---|
| `raw_input` | string | Yes | 10240 chars | Place URL, name, or free-text description |

---

## Success Response — `200 OK`

```json
{
  "place_id": "550e8400-e29b-41d4-a716-446655440000",
  "place": {
    "place_name": "Fuji Ramen",
    "address": "123 Sukhumvit Soi 33, Bangkok",
    "cuisine": "ramen",
    "price_range": "low"
  },
  "confidence": 0.9,
  "status": "resolved",
  "requires_confirmation": false,
  "source_url": "https://www.tiktok.com/@foodie/video/123"
}
```

Response is the `AiExtractPlaceResponse` from the AI service, passed through without modification.

---

## Error Responses

| Status | Trigger | Body |
|---|---|---|
| `400 Bad Request` | Missing or empty `raw_input`, input exceeds 10KB, AI service returns 400 | Validation message or `{ "statusCode": 400, "message": "..." }` |
| `401 Unauthorized` | Missing or invalid Clerk token | `{ "statusCode": 401, "message": "Unauthorized" }` |
| `422 Unprocessable Entity` | AI service returns 422 | `{ "statusCode": 422, "message": "couldn't understand your request" }` |
| `503 Service Unavailable` | AI service returns 500, timeout, or no response | `{ "statusCode": 503, "message": "service temporarily unavailable, please retry" }` |
| `500 Internal Server Error` | Unexpected error | `{ "statusCode": 500, "message": "Internal server error" }` |

---

## Bruno Test File

A corresponding `.bru` request file must be created at:
```
kebi-config/bruno/places/extract-place.bru
```

Per ADR-021 (Bruno for API testing, no Swagger).
