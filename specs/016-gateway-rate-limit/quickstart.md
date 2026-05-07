# Quickstart: Bruno Test Scenarios (016)

All Bruno test files live in `kebi-config/bruno/rate-limit/`.  
Requires: NestJS running on `http://localhost:3333`, FastAPI running on `http://localhost:8000`.  
Auth: Use `DEV_BYPASS_TOKEN` for all requests (set in `.env.local`).

---

## Setup: Shared Variables

In the Bruno collection environment file, set:
```
base_url: http://localhost:3333/api/v1
auth_token: {{DEV_BYPASS_TOKEN}}
```

---

## Test 1: tool_calls_per_day breach

**File**: `kebi-config/bruno/rate-limit/tool-calls-breach.bru`

**Precondition**: Manually set the homebody user's `toolCalls.count` to 30 (via a debug endpoint or by sending 30 turns that each accumulate tool calls until done events total 30).

**Request**:
```
POST {{base_url}}/chat
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "message": "find me dinner nearby"
}
```

**Expected response**:
- Status: `429`
- Body: `{ "error": "rate_limit_exceeded", "limit": "tool_calls_per_day", "limit_value": 30 }`

---

## Test 2: turns_per_session breach

**File**: `kebi-config/bruno/rate-limit/turns-breach.bru`

**Precondition**: User's `turns` counter is at 10 (send 10 messages in one session).

**Request**:
```
POST {{base_url}}/chat
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "message": "one more question"
}
```

**Expected response**:
- Status: `429`
- Body: `{ "error": "rate_limit_exceeded", "limit": "turns_per_session", "limit_value": 10 }`

---

## Test 3: sessions_per_day breach

**File**: `kebi-config/bruno/rate-limit/sessions-breach.bru`

**Precondition**: User has had 3 sessions today (turns was reset 3 times by `session_started` events).

**Request**:
```
POST {{base_url}}/chat
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "message": "start another chat"
}
```

**Expected response**: Depends on whether turns and tool_calls have capacity. If only sessions are exhausted:
- Status: `429`
- Body: `{ "error": "rate_limit_exceeded", "limit": "sessions_per_day", "limit_value": 3 }`

---

## Test 4: Logout resets turns but not daily counters

**File**: `kebi-config/bruno/rate-limit/logout-reset.bru`

**Sequence**:
1. Accumulate 5 turns in current session
2. Trigger Clerk `session.ended` webhook (fire the webhook event manually or via Clerk test tool)
3. Send a new message

**Expected after step 3**:
- `turns` is 0 before the guard increments it → first new turn is turn 1 → request passes
- `sessions_per_day` and `tool_calls_per_day` are unchanged from before logout

**Assertion**: Response is a valid SSE stream (not 429), and on the next `session_started` event, sessions_per_day increments from its pre-logout value (not reset to 0).

---

## Test 5: Day rollover resets daily counters but not turns

**File**: `kebi-config/bruno/rate-limit/day-rollover.bru`

**Precondition**: Manually set `sessions.date` and `toolCalls.date` to yesterday's UTC date string (via a debug/test endpoint or by inspecting in-memory state in a test environment).

**Request**:
```
POST {{base_url}}/chat
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "message": "good morning"
}
```

**Expected behavior**:
- `sessions.count` resets to 0 (date was yesterday)
- `toolCalls.count` resets to 0 (date was yesterday)
- `turns` is unchanged
- Request proceeds (guard sees counts of 0, under any plan threshold)

**Assertion**: Response is a valid SSE stream (not 429).

---

## Test 6: Missing plan falls back to default_plan

**File**: `kebi-config/bruno/rate-limit/default-plan-fallback.bru`

**Precondition**: User token has no `plan` field in `public_metadata`.

**Request**: Send a chat message.

**Expected behavior**: Guard uses `config.rate_limits.default_plan` (homebody) for thresholds. No error. Verify by exhausting homebody's `sessions_per_day: 3` threshold and getting a 429 with `"limit_value": 3`.
