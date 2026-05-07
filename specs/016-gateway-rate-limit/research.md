# Research: Gateway Per-User Rate Limiting (016)

## Decision 1: Synchronous JSON response — no SSE

**Decision**: Retain the existing synchronous `POST /api/v1/chat` → JSON `ChatResponseDto` response model. FastAPI adds two new top-level fields to every response: `tool_calls_used: number` (always present) and `session_started?: true` (present only when a new Redis session key is created; absent otherwise). NestJS reads these fields from the returned `ChatResponseDto` and updates in-memory counters inside `ChatService` after `aiClient.chat()` returns.

**Rationale**: No streaming is needed for rate limit tracking. The existing request/response contract (ADR-036) is preserved exactly. No new ADR is required. The `@Serialize()` interceptor (ADR-023) continues to apply.

**Alternatives considered**:
- SSE streaming with event interception — Significantly more complex; no frontend requirement for streaming at this time. Deferred per ADR-036 for a future feature.

---

## Decision 2: AuthUser type placement

**Decision**: Add `AuthUser` (with `plan?: PlanTier`) and `PlanTier` to `libs/shared/src/lib/types.ts`. Update `clerk.middleware.ts` to import `AuthUser` from `@kebi-app/shared` instead of using the local `ClerkUser` interface. The Express `Request.user` global augmentation stays in `clerk.middleware.ts` (services/api only).

**Rationale**: `libs/shared` is the canonical location for types consumed across multiple packages (CLAUDE.md standard). `AuthUser` will be read by `RateLimitGuard` (services/api) and will eventually be needed by any future frontend type-checking. The Express namespace augmentation is NestJS-specific and stays in services/api.

**Alternatives considered**:
- Keep `ClerkUser` local to `services/api` — Blocks future frontend type safety; duplicates type definition.
- Move entire Express augmentation to `libs/shared` — Pulls Node.js/Express types into a shared lib used by Next.js; violates Nx boundary spirit.

---

## Decision 3: In-memory rate limit state (no Redis)

**Decision**: `RateLimitService` holds a `Map<string, UserRateLimitState>`. Node.js is single-threaded, so there is no race condition on Map reads/writes. No eviction strategy for this phase — map entries accumulate per user (acceptable at current scale). Redis is the documented Phase 6 upgrade path (per spec FR-011).

**Rationale**: Redis is FastAPI-only (ADR Constitution §I). NestJS never touches Redis. In-memory is the correct phase-1 choice.

**Alternatives considered**:
- Redis via a NestJS adapter — Violates Constitution §I (NestJS never touches Redis).
- PostgreSQL counter table — DB writes from NestJS are product-data-only; rate counters are not product data (Constitution §V).

---

## Decision 4: RateLimitModule as non-global module imported explicitly

**Decision**: `RateLimitModule` is a standard NestJS module (not `@Global()`). It is imported in `ChatModule` (for `RateLimitGuard`) and in `AppModule` (so `ClerkWebhookController` can inject `RateLimitService` for session reset). `RateLimitService` is exported from the module.

**Rationale**: `@Global()` modules obscure dependency origins and make testing harder. Explicit imports keep the dependency graph visible and testable (NestJS expert best practice).

**Alternatives considered**:
- `@Global()` module — Hides dependencies; harder to mock in unit tests.
- Re-export from AppModule — Unnecessary indirection.

---

## Decision 5: Clerk session.ended webhook for logout turns reset

**Decision**: Extend `clerk.webhook.ts` to handle `session.ended` Clerk event. On receipt, extract `userId` from event data and call `rateLimitService.resetTurns(userId)`. No dedicated NestJS logout endpoint is needed.

**Rationale**: The spec requires "triggered internally from logout handler and Clerk webhook handler only — the frontend MUST NOT call a session-reset endpoint directly." Clerk's `session.ended` fires on explicit sign-out, session expiry, and revocation — all three cases that should reset turns. This is a clean backend-only pattern.

**Alternatives considered**:
- Dedicated `POST /api/v1/auth/logout` endpoint — Would require frontend to call it; contradicts spec requirement.
- Periodic cleanup job — Resets turns proactively; doesn't map to the user's actual logout event.

---

## Decision 6: No new ADR required

**Decision**: This feature does not introduce SSE streaming. The synchronous `chat()` method in `IAiServiceClient` is unchanged. ADR-036 is not superseded. The `@Serialize()` interceptor (ADR-023) continues to apply. All constitution gates pass without deviations. No new ADR needed before implementation.

---

## Codebase Findings (from exploration)

### ClerkUser current state
- Defined inline in `services/api/src/common/middleware/clerk.middleware.ts` (lines 18–21)
- NOT in `libs/shared` — must be migrated
- Used in: `ai-enabled.guard.ts` (imported from middleware), `clerk.middleware.ts`

### Config current state (`config/app.yaml`)
```yaml
app:
  environment: development
  port: 3333
  api_prefix: api/v1

auth:
  public_paths:
    - /health
    - /webhooks/clerk

ai:
  enabled_default: true
  global_kill_switch: false
```
`rate_limits` block does not exist yet — must be added.

### AiServiceClient current state
- `chat(payload: ChatRequestDto): Promise<ChatResponseDto>` — synchronous JSON response
- Must be extended with `chatStream(payload: ChatRequestDto): AsyncGenerator<SseEvent> | Observable<SseEvent>`
- Uses `firstValueFrom(httpService.post(...))` — must change to streaming

### Chat service current state
- `return this.aiClient.chat({...})` — single awaited call, returns ChatResponseDto
- Must be refactored to proxy SSE stream with `@Res()` pattern

### Webhook current state
- Handles only `user.created` event
- Must be extended to handle `session.ended`

### Logout / session reset
- No logout endpoint exists
- Must be added via webhook extension only
