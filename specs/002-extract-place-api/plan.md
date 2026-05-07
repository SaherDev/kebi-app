# Implementation Plan: Place Extraction API Infrastructure

**Branch**: `002-extract-place-api` | **Date**: 2026-03-25 | **Spec**: [spec.md](./spec.md)

---

## Summary

Add a global `ValidationPipe` and `AllExceptionsFilter` to `services/api/main.ts`, then replace the `POST /extract-place` stub in `AppController` with a real `PlacesModule` that provides `POST /places/extract` as a facade over `AiServiceClient.extractPlace()`.

---

## Technical Context

**Language/Version**: TypeScript 5.x / Node 20 LTS
**Primary Dependencies**: NestJS 11, `class-validator`, `class-transformer`, `@nestjs/axios` (Axios), `@nestjs/config`
**Storage**: N/A — no database writes in this feature
**Testing**: Jest (unit tests for filter and service)
**Target Platform**: NestJS API service (`services/api`)
**Project Type**: Web service — thin HTTP gateway
**Performance Goals**: Validation and error mapping add < 1ms overhead per request
**Constraints**: No DB queries, no business logic, AxiosError propagates raw from service to filter
**Scale/Scope**: Single new module (3 files), 2 `main.ts` additions, 1 `app.controller.ts` removal, 1 filter file

---

## Constitution Check

*Gate: Must pass before implementation.*

| Rule | Status | Notes |
|---|---|---|
| NestJS stays thin gateway | ✅ Pass | Controller is pure facade, service makes one AI call, no DB writes |
| Nx module boundaries | ✅ Pass | `PlacesModule` only imports `AiServiceModule` (within `services/api`) |
| ADR-017: Global ValidationPipe | ✅ Required | This feature implements it |
| ADR-018: Global AllExceptionsFilter | ✅ Required | This feature implements it |
| ADR-014: One module per domain | ✅ Pass | `PlacesModule` is its own domain module |
| ADR-016: AiServiceClient via interface | ✅ Pass | Service injects `IAiServiceClient` via `AI_SERVICE_CLIENT` token |
| ADR-032: Facade controller | ✅ Pass | Controller makes exactly one service call |
| ADR-033: Interface-first DI | ✅ Pass | `PlacesService` depends on `IAiServiceClient` interface |
| ADR-021: Bruno for API testing | ✅ Required | `.bru` file must be created |
| No Redis, no LLM, no embeddings | ✅ Pass | None of these are touched |

---

## Project Structure

### Documentation (this feature)

```text
specs/002-extract-place-api/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── contracts/
│   └── places-extract.md
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code Changes

```text
services/api/src/
├── main.ts                                        ← ADD ValidationPipe + AllExceptionsFilter
├── app/
│   └── app.controller.ts                          ← REMOVE extractPlace() stub
│   └── app.module.ts                              ← ADD PlacesModule import
├── common/
│   └── filters/
│       └── all-exceptions.filter.ts               ← CREATE (ADR-018)
└── places/                                        ← CREATE new domain module (ADR-014)
    ├── places.module.ts
    ├── places.controller.ts
    ├── places.service.ts
    └── dto/
        └── extract-place-request.dto.ts

kebi-config/bruno/places/
└── extract-place.bru                              ← CREATE (ADR-021)
```

---

## Implementation Steps

### Step 1 — `AllExceptionsFilter`

**File**: `services/api/src/common/filters/all-exceptions.filter.ts`

Create a `@Catch()` filter implementing `ExceptionFilter`:

```typescript
// Pseudocode — reference only
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    // 1. If HttpException (NestJS built-in): pass through status and message
    // 2. If AxiosError with response:
    //    - status 400 → 400
    //    - status 422 → 422 "couldn't understand your request"
    //    - status 500 (or any other 5xx) → 503 "service temporarily unavailable, please retry"
    // 3. If AxiosError without response (timeout / ECONNABORTED / network):
    //    → 503 "service temporarily unavailable, please retry"
    // 4. Any other exception → 500 Internal Server Error
  }
}
```

**Key implementation detail**: Detect `AxiosError` using `axios.isAxiosError(exception)` (not `instanceof`). Check `exception.response` to distinguish AI service errors from timeout/network errors.

---

### Step 2 — Register in `main.ts`

Add to `bootstrap()` in `services/api/src/main.ts`:

```typescript
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}));

app.useGlobalFilters(new AllExceptionsFilter());
```

Order matters: `useGlobalFilters` before `useGlobalPipes` is fine — both are middleware-layer registrations that apply to all requests.

---

### Step 3 — `ExtractPlaceRequestDto`

**File**: `services/api/src/places/dto/extract-place-request.dto.ts`

```typescript
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class ExtractPlaceRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10240)
  raw_input: string;
}
```

---

### Step 4 — `PlacesService`

**File**: `services/api/src/places/places.service.ts`

```typescript
// One method, one AI client call, no try/catch
// AxiosError propagates raw to AllExceptionsFilter
async extractPlace(userId: string, dto: ExtractPlaceRequestDto): Promise<AiExtractPlaceResponse> {
  return this.aiClient.extractPlace({ user_id: userId, raw_input: dto.raw_input });
}
```

**Critical**: No `try/catch` around the AI client call. AxiosError must reach `AllExceptionsFilter` unmodified.

---

### Step 5 — `PlacesController`

**File**: `services/api/src/places/places.controller.ts`

```typescript
@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Post('extract')
  @RequiresAi()
  extractPlace(@CurrentUser() userId: string, @Body() dto: ExtractPlaceRequestDto) {
    return this.placesService.extractPlace(userId, dto);
  }
}
```

Route resolves to `POST /api/v1/places/extract` (global prefix `api/v1` + controller `places` + method `extract`).

---

### Step 6 — `PlacesModule`

**File**: `services/api/src/places/places.module.ts`

```typescript
@Module({
  imports: [AiServiceModule],
  controllers: [PlacesController],
  providers: [PlacesService],
})
export class PlacesModule {}
```

---

### Step 7 — Update `AppModule`

Add `PlacesModule` to the `imports` array in `services/api/src/app/app.module.ts`.

---

### Step 8 — Remove stub from `AppController`

Remove the `@Post('extract-place')` method and the `@RequiresAi()` import (if no longer used) from `services/api/src/app/app.controller.ts`.

---

### Step 9 — Bruno test file

**File**: `kebi-config/bruno/places/extract-place.bru`

Create a Bruno request for `POST {{baseUrl}}/api/v1/places/extract` with a test body. Per ADR-021.

---

## Testing Plan

### Unit Tests

1. **`AllExceptionsFilter`** — `all-exceptions.filter.spec.ts`
   - AxiosError with status 400 → responds 400
   - AxiosError with status 422 → responds 422 with correct message
   - AxiosError with status 500 → responds 503 with correct message
   - AxiosError with no response (timeout) → responds 503 with correct message
   - NestJS `HttpException` (e.g., 401) → passes through
   - Generic `Error` → responds 500

2. **`PlacesService`** — `places.service.spec.ts`
   - Happy path: calls `aiClient.extractPlace()` with correct payload, returns result
   - Propagates error without wrapping (let AxiosError pass through)

### Integration

- `pnpm nx test api` — all existing tests must pass after changes
- Verify ValidationPipe: send request without `raw_input` → expect 400
- Verify filter: mock AI service to return 422 → expect 503... no, 422 per mapping
- Test `POST /api/v1/places/extract` route exists and is reachable

---

## Verify Commands

```bash
pnpm nx test api          # All unit tests pass
pnpm nx lint api          # No lint errors
pnpm nx build api         # TypeScript compiles cleanly
```
