# Contract: ChatResponseDto Extension

**Applies to**: `POST /v1/chat` (kebi → NestJS) — all intent types  
**File to update**: `libs/shared/src/lib/types.ts`

---

## Two new fields on ChatResponseDto

| Field             | Type     | Required | Notes |
|---|---|---|---|
| `tool_calls_used` | `number` | Always   | Count of LangChain tool invocations this turn. 0 when no tools were called. |
| `session_started` | `true`   | Optional | Present only when FastAPI creates a new Redis session key. **Absent** (not `false`) when an existing session was continued. |

---

## Wire examples

**New session:**
```json
{
  "type": "consult",
  "message": "Try Nara Eatery",
  "data": { ... },
  "session_started": true,
  "tool_calls_used": 3
}
```

**Existing session (any intent):**
```json
{
  "type": "recall",
  "message": "Found 2 matches",
  "data": { ... },
  "tool_calls_used": 1
}
```

---

## NestJS handling (ChatService)

```typescript
const response = await this.aiClient.chat(payload);

// always: increment turns before call (done in service before aiClient.chat())
// always: accumulate tool calls
this.rateLimitService.addToolCalls(userId, response.tool_calls_used);

// conditionally: new session
if (response.session_started) {
  this.rateLimitService.onSessionStarted(userId);
}

return response;
```

`session_started` is not forwarded to the frontend — it is consumed internally by NestJS. `tool_calls_used` is also consumed internally.

---

## TypeScript type

```typescript
export interface ChatResponseDto {
  type: ChatResponseType;
  message: string;
  data: ConsultResponseData | RecallResponseData | ExtractPlaceData | Record<string, unknown> | null;
  tool_calls_used: number;
  session_started?: true;
}
```
