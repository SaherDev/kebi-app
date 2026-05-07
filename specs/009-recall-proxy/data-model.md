# Data Model: 009-recall-proxy

**Date**: 2026-03-31
**Branch**: `009-recall-proxy`

---

## Overview

No database changes. Recall is a pure proxy — NestJS forwards the request to kebi and returns the response. No writes to any table.

---

## DTO Changes (TypeScript)

### RecallRequestDto — MODIFIED

`services/api/src/recall/dto/recall-request.dto.ts`

Add `user_id` field:

| Field    | Type   | Validation                    | Source        |
|----------|--------|-------------------------------|---------------|
| query    | string | @IsString @IsNotEmpty @MaxLength(500) | Body |
| user_id  | string | @IsString @IsNotEmpty         | Body (for now) |

**Note**: `user_id` is temporary in the body. Future: injected from Clerk auth via `@CurrentUser()`.

---

### RecallPlaceDto — MODIFIED

`services/api/src/recall/dto/recall-place.dto.ts`

Add `saved_at` field to match api-contract.md:

| Field        | Type   | Required | Description                             |
|--------------|--------|----------|-----------------------------------------|
| place_id     | string | ✓        | UUID of the saved place                 |
| place_name   | string | ✓        | Display name                            |
| address      | string | ✓        | Full address                            |
| cuisine      | string | ✗        | Cuisine type, may be null               |
| price_range  | string | ✗        | Price range, may be null                |
| source_url   | string | ✗        | Original TikTok/URL if applicable       |
| match_reason | string | ✓        | Why this place matched the query        |
| saved_at     | string | ✗        | ISO 8601 timestamp when place was saved |

---

### RecallResponseDto — NO CHANGE

`services/api/src/recall/dto/recall-response.dto.ts`

Shape `{ results: RecallPlaceDto[], total: number }` is already correct.

---

## Interface Changes (AI Service Client)

### IAiServiceClient — MODIFIED

`services/api/src/ai-service/ai-service-client.interface.ts`

Add two types + one method:

**AiRecallPayload**:
| Field   | Type   | Description                        |
|---------|--------|------------------------------------|
| user_id | string | User ID forwarded to kebi     |
| query   | string | Raw memory fragment from user      |

**AiRecallResponse**:
| Field   | Type              | Description                      |
|---------|-------------------|----------------------------------|
| results | AiRecallPlace[]   | Matching saved places            |
| total   | number            | Count of results                 |

**AiRecallPlace** (inline or separate — matches RecallPlaceDto):
| Field        | Type   | Required |
|--------------|--------|----------|
| place_id     | string | ✓        |
| place_name   | string | ✓        |
| address      | string | ✓        |
| cuisine      | string | ✗        |
| price_range  | string | ✗        |
| source_url   | string | ✗        |
| match_reason | string | ✓        |
| saved_at     | string | ✗        |

**recall() method signature**:
```
recall(payload: AiRecallPayload): Promise<AiRecallResponse>
```
- Timeout: 20 seconds (Constitution §VI)
- URL: `${baseUrl}/v1/recall`
- Method: POST
- AxiosError propagates raw → `AllExceptionsFilter` maps to 503

---

## No Schema Changes

Recall results are not persisted. No migration needed.
