# Phase 1 Data Model

This feature introduces **no database schema changes**. All persistence lives in `kebi`. What follows is the in-memory / wire model owned by the gateway and `libs/shared`.

## Entities

### 1. `ConsultResponseData` (extended in `libs/shared/src/lib/types.ts`)

Widen the existing interface with a nullable `recommendation_id` at the top level of the consult payload.

```ts
export interface ConsultResponseData {
  recommendation_id: string | null;           // NEW — FastAPI UUID; null when persist failed
  primary: ConsultPlace;                      // existing
  alternatives: ConsultPlace[];               // existing
  reasoning_steps: ReasoningStep[];           // existing
  context_chips?: string[];                   // existing
}
```

Field-level notes:
- `recommendation_id` is **always present** (SC-001). A `null` value is a successful-but-unpersisted state, not an absent key.
- Adding the field is additive; existing code that ignores unknown fields on `ConsultResponseData` continues to work (ADR-019).

### 2. `UserContextResponse` (new, in `libs/shared/src/lib/types.ts`)

```ts
export interface UserContextChip {
  label: string;
  source_field: string;
  source_value: string;
  signal_count: number;
}

export interface UserContextResponse {
  saved_places_count: number;
  chips: UserContextChip[];
}
```

Field-level notes:
- No `user_id` in the response body (Clarify Q4 — FastAPI typo).
- `chips` is always an array; for a cold-start user it is `[]` (FR-018).
- `signal_count` is a non-negative integer; zero is never emitted because FastAPI filters chips with no reinforcement.

Validation rules (gateway-side — DTO class in `services/api`):
- `saved_places_count`: `@IsInt() @Min(0)` via `@Expose()` on response DTO (`@Serialize()`).
- Each chip field: `@IsString() @IsNotEmpty()` for label/source_field/source_value; `@IsInt() @Min(0)` for signal_count.
- Response DTOs only declare `@Expose()` — they do not reject upstream shape mismatches; the gateway trusts FastAPI here (per ADR-019 policy for AI responses).

### 3. `SignalRequest` / `SignalRequestWithUser` (new, in `libs/shared/src/lib/types.ts`)

Shared type is a discriminated union on `signal_type`. The frontend-visible variant does **not** include `user_id` — the gateway injects it before forwarding.

```ts
export type SignalType =
  | 'recommendation_accepted'
  | 'recommendation_rejected';

export interface SignalRequestAccepted {
  signal_type: 'recommendation_accepted';
  recommendation_id: string;
  place_id: string;
}

export interface SignalRequestRejected {
  signal_type: 'recommendation_rejected';
  recommendation_id: string;
  place_id: string;
}

export type SignalRequest = SignalRequestAccepted | SignalRequestRejected;

/** Payload forwarded to FastAPI — gateway-internal only */
export type SignalRequestWithUser = SignalRequest & { user_id: string };
```

Validation rules (gateway-side `SignalRequestDto` in `services/api/src/signal/dto/`):
- `signal_type`: `@IsIn(['recommendation_accepted', 'recommendation_rejected'])`.
- `recommendation_id`: `@IsString() @IsNotEmpty()`.
- `place_id`: `@IsString() @IsNotEmpty()`.
- `whitelist: true, forbidNonWhitelisted: true` (ADR-017) rejects any additional field.

### 4. `SignalResponse` (new, in `libs/shared/src/lib/types.ts`)

```ts
export interface SignalResponse {
  status: string; // e.g. "accepted"
}
```

Notes:
- Kept as a free-form string for forward compatibility with FastAPI additions (e.g. `"deduped"` in a future ADR).
- The gateway passes this body through with HTTP 202 (FR-009).

## State transitions

None. All three flows are single-shot request/response:

1. **Consult**: no new state — only a new field on the existing response.
2. **Signal**: Client → Gateway → FastAPI → (persist in `interaction_log`) → 202. Gateway holds no state between requests.
3. **User Context**: Client → Gateway → FastAPI (reads `taste_model`, `places` counts) → 200. Gateway holds no state.

## Uniqueness & identity

| Identifier | Source | Gateway treatment |
|------------|--------|-------------------|
| `recommendation_id` | FastAPI (UUID from `recommendations` table) | Pass-through; never minted or mutated by NestJS |
| `place_id` | Arbitrary string from caller (trusted per FastAPI contract) | Validated as non-empty only; no existence check |
| `user_id` | Clerk JWT (populated onto `request.user.id` by `ClerkMiddleware`) | Injected server-side into signal payload; never accepted from request body |

## Nx Module Boundary verification (Constitution §II)

| Type | Lives in | Imported by |
|------|----------|-------------|
| `ConsultResponseData` (extended) | `libs/shared` | `services/api`, `apps/web` |
| `UserContextResponse`, `UserContextChip` | `libs/shared` | `services/api`, `apps/web` (future) |
| `SignalRequest`, `SignalResponse`, `SignalType`, `SignalRequestWithUser` | `libs/shared` | `services/api`, `apps/web` (future) |
| `SignalRequestDto`, `SignalResponseDto`, `UserContextResponseDto` | `services/api` (feature modules) | only within `services/api` |

No cross-boundary violations. `libs/shared` imports nothing (§II preserved).
