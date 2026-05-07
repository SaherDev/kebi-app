# Quickstart — Feature 014 Signal & User Context Endpoints

End-to-end manual verification path. Run after implementation is complete and before marking the task done.

## Prerequisites

- NestJS dev server: `pnpm nx serve api` (port 3333, base `http://localhost:3333/api/v1`)
- FastAPI dev server running at `AI_SERVICE_BASE_URL` (default `http://localhost:8000`) with the matching `022-recommendations-context-signals` contract implemented
- Valid Clerk session token available as `CLERK_TOKEN` in Bruno's environment
- Bruno desktop or CLI; collection at `kebi-config/bruno/nestjs-api/`

## Step 1 — Verify consult returns `recommendation_id`

Bruno request: existing `Chat — Consult` (or equivalent chat call that triggers consult intent).

```json
POST /api/v1/chat
{
  "message": "cheap dinner nearby",
  "location": { "lat": 13.7563, "lng": 100.5018 }
}
```

**Expected**: response `data.recommendation_id` is a non-empty UUID string. Record the value for step 2.

**If null**: FastAPI persist failed. Not a gateway bug. Retry after the AI service recovers, or use a known valid UUID from the DB for step 2.

## Step 2 — Post an accepted signal

Bruno request: `Signal — Accepted`.

```json
POST /api/v1/signal
{
  "signal_type": "recommendation_accepted",
  "recommendation_id": "<UUID from step 1>",
  "place_id": "google:ChIJN1t_tDeuEmsRUsoyG83frY4"
}
```

**Expected**:
- Status `202 Accepted`
- Body `{ "status": "accepted" }` (pass-through from FastAPI)

## Step 3 — Post a rejected signal

Bruno request: `Signal — Rejected`. Same URL, `signal_type: recommendation_rejected`, same `recommendation_id` as step 2.

**Expected**: `202 Accepted`. Same body shape.

## Step 4 — Post a bogus `recommendation_id`

Bruno request: `Signal — Bogus Recommendation ID`.

```json
POST /api/v1/signal
{
  "signal_type": "recommendation_accepted",
  "recommendation_id": "00000000-0000-0000-0000-000000000000",
  "place_id": "google:ChIJN1t_tDeuEmsRUsoyG83frY4"
}
```

**Expected**:
- Status `404 Not Found`
- Body `{ "detail": "Recommendation not found" }` (pass-through from FastAPI)

## Step 5 — Malformed request

In Bruno, remove `place_id` from the body and send.

**Expected**:
- Status `400 Bad Request`
- Body contains `class-validator` error mentioning `place_id` must not be empty

## Step 6 — Unknown `signal_type`

Change `signal_type` to `"nonsense"` and send.

**Expected**:
- Status `400 Bad Request`
- Body contains `class-validator` error mentioning `signal_type` must be one of the allowed values

## Step 7 — Call `/user/context`

Bruno request: `User Context`.

```http
GET /api/v1/user/context
```

**Expected** (populated user):
```json
{
  "saved_places_count": <number ≥ 0>,
  "chips": [ { "label": "...", "source_field": "...", "source_value": "...", "signal_count": <number> }, ... ]
}
```

**Expected** (cold-start user):
```json
{
  "saved_places_count": 0,
  "chips": []
}
```

No `user_id` field in the response body.

## Step 8 — Auth checks

- Remove the `Authorization` header from any of the above requests → `401 Unauthorized`.
- Flip the user's `ai_enabled: false` in Clerk dashboard and retry `/signal` or `/user/context` → `403 Forbidden`.

## Step 9 — Automated checks (prior to PR)

```bash
pnpm nx test api
pnpm nx lint api
pnpm nx build api
```

All three must pass. SC-006 gate.

## Step 10 — Verify no DB writes

Spot-check: there should be no new TypeORM entity file, no new migration, no INSERT in the signal or user-context controllers/services. Grep:

```bash
pnpm grep -rn "InsertResult\|save\(\|TypeOrmModule.forFeature" services/api/src/signal services/api/src/user-context
```

**Expected**: zero matches. SC-005 gate.
