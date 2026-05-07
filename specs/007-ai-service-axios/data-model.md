# Data Model: AI Service Client — Migrate to Axios and Add extractPlace

**Generated**: 2026-03-25
**Branch**: `001-ai-service-axios`

This feature adds no database tables or migrations. It only modifies the TypeScript interface and implementation of the AI service client. The data model here describes the TypeScript type contract between NestJS and kebi.

---

## AiExtractPlacePayload

The request body sent from NestJS to kebi's `POST /v1/extract-place` endpoint.

| Field       | Type     | Nullable | Description                                      |
|-------------|----------|----------|--------------------------------------------------|
| `user_id`   | `string` | No       | Clerk user ID, injected from auth token          |
| `raw_input` | `string` | No       | Unmodified user input: URL, text, or hybrid      |

Validation: `raw_input` must not be empty (AI service returns 400 if it is).

---

## AiExtractPlaceResponse

The response body returned by kebi's `POST /v1/extract-place` endpoint.

| Field                  | Type                          | Nullable | Description                                             |
|------------------------|-------------------------------|----------|---------------------------------------------------------|
| `place_id`             | `string`                      | Yes      | UUID of the saved place record; null if unresolved      |
| `place`                | `AiExtractedPlace` (object)   | No       | Extracted place metadata                                |
| `confidence`           | `number`                      | No       | 0.0–1.0 match confidence score                          |
| `status`               | `'resolved' \| 'unresolved'`  | No       | Whether the place was successfully identified           |
| `requires_confirmation`| `boolean`                     | No       | True if confidence is between 0.30 and 0.70             |
| `source_url`           | `string`                      | Yes      | Original TikTok URL; null for plain-text input          |

### AiExtractedPlace (nested object)

| Field         | Type     | Nullable | Description                               |
|---------------|----------|----------|-------------------------------------------|
| `place_name`  | `string` | Yes      | Extracted place name; null if unresolved  |
| `address`     | `string` | Yes      | Formatted address; null if unresolved     |
| `cuisine`     | `string` | Yes      | Cuisine type if determinable; else null   |
| `price_range` | `string` | Yes      | Price range if determinable; else null    |

---

## Unchanged Types (for reference)

These types exist in `ai-service-client.interface.ts` and are not modified by this feature.

### AiConsultPayload

Extends `ConsultRequest` from `@kebi-app/shared`, adds `user_id: string`.

### AiConsultResponse

Contains `primary: AiPlaceResult`, `alternatives: AiPlaceResult[]`, `reasoning_steps: AiReasoningStep[]`.

---

## Interface Changes Summary

| Symbol                    | File                              | Change        |
|---------------------------|-----------------------------------|---------------|
| `AiExtractPlacePayload`   | `ai-service-client.interface.ts`  | **Add**       |
| `AiExtractedPlace`        | `ai-service-client.interface.ts`  | **Add**       |
| `AiExtractPlaceResponse`  | `ai-service-client.interface.ts`  | **Add**       |
| `IAiServiceClient`        | `ai-service-client.interface.ts`  | **Add method** (`extractPlace`) |
| `AiServiceClient`         | `ai-service.client.ts`            | **Modify** (swap transport, add method) |
| `AiServiceModule`         | `ai-service.module.ts`            | **Modify** (register HttpModule) |
