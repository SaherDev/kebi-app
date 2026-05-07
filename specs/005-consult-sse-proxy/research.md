# Research: Consult SSE Proxy

**Feature**: 001-consult-sse-proxy
**Phase**: 0 — Research & Unknowns Resolution

---

## 1. HTTP Transport for AiServiceClient

**Decision**: Use Node's built-in `http`/`https` modules (no new dependency).

**Rationale**:
- `@nestjs/axios` (Axios) is not in `services/api/package.json`. Adding it just for SSE would pull in Axios and `@nestjs/axios`.
- Axios has long-standing issues with SSE: it buffers responses and requires `responseType: 'stream'` hacks that are unreliable.
- Node's native `http.request()` returns an `http.IncomingMessage` — a `Readable` stream natively. This makes `stream.pipeline()` trivial.
- Node 20 LTS (project requirement from CLAUDE.md) ships `http`/`https` built-in. Zero new packages.
- ADR-016 says "wraps NestJS HttpModule (Axios)" — but is marked "implementation pending". Using native http satisfies the same intent (abstracted HTTP client) without the streaming workaround.

**Alternatives considered**:
- `@nestjs/axios` + Axios: Adds a dependency, has SSE buffering issues. Rejected.
- `undici` (Node 18+ builtin): More ergonomic than `http`, but `http` is simpler and already familiar. Acceptable alternative if `undici` fetch is needed later.
- `node-fetch`: Third-party, unnecessary given native support.

---

## 2. SSE Proxy Pattern in NestJS

**Decision**: Use `@Res() res: Response` with manual headers + `stream.pipeline()`.

**Rationale**:
- `@Sse()` decorator (NestJS built-in) uses `Observable` and wraps responses in `{ data: ... }` JSON. This double-wraps the FastAPI SSE events and breaks the format.
- `@Res()` gives raw Express response, enabling direct header control and stream passthrough.
- `stream.pipeline()` automatically cleans up all streams (upstream + downstream) on error or completion — superior to `stream.pipe()` which only cleans up on end, not error.
- Setting `X-Accel-Buffering: no` prevents nginx/Railway from buffering SSE.

**SSE headers required** (must be set before any write):
```
Content-Type: text/event-stream
Cache-Control: no-cache
X-Accel-Buffering: no
```
Then: `res.flushHeaders()` to send headers immediately.

**Backpressure**: Check `res.write()` return value. If `false`, the downstream buffer is full. Pause the upstream readable stream; resume on the response `drain` event.

---

## 3. Client Disconnect Cleanup

**Decision**: `req.on('close', ...)` + `stream.destroy()` on the upstream.

**Rationale**:
- Without cleanup, a browser disconnect leaves the FastAPI request alive. Under load this accumulates upstream connections.
- `req.on('close')` fires on browser disconnect (tab close, navigation, network loss).
- Calling `upstream.destroy()` on the FastAPI response stream terminates the HTTP connection.
- `stream.pipeline()` also handles this via its callback, but explicit `close` listener is added for cases where pipeline hasn't started yet.

---

## 4. AiServiceClient Interface Design

**Decision**: Interface with two methods: `consult()` (sync JSON) and `consultStream()` (returns Readable).

**Rationale** (ADR-033 — interface abstraction for swappable dependencies):
- `AiServiceClient` meets all three criteria for interface abstraction: (1) could be swapped (mock for tests), (2) external system, (3) must be mockable.
- Two method signatures keep concerns separate: sync path and stream path.

```typescript
interface IAiServiceClient {
  consult(userId: string, payload: AiConsultPayload): Promise<AiConsultResponse>;
  consultStream(userId: string, payload: AiConsultPayload): Promise<Readable>;
}
```

---

## 5. Missing Config: ai_service.base_url

**Finding**: `services/api/config/.local.yaml` does not have an `ai_service` section. ADR-016 requires base URL from `ConfigService`.

**Decision**: Add to `.local.yaml` (local dev value) and document the key as `ai_service.base_url`.

```yaml
ai_service:
  base_url: http://localhost:8000
```

Production Railway service URL will be injected via environment (the YAML `${AI_SERVICE_URL}` syntax).

---

## 6. ConsultModule Does Not Exist Yet

**Finding**: `services/api/src/consult/` does not exist. The feature description assumes it does (refers to modifying `consult.controller.ts`). This is a net-new module.

**Decision**: Create the full `ConsultModule` (module, controller, service, DTOs) following the `RecallModule` pattern.

---

## 7. Bruno File Location

**Finding**: `kebi-config/bruno/nestjs-api/` contains NestJS API request files (recall.bru, hello.bru). The feature spec says `kebi-config/bruno/consult-stream-nestjs.bru` but the correct location per existing convention is `nestjs-api/`.

**Decision**: Create at `kebi-config/bruno/nestjs-api/consult-stream.bru`. Also note: a non-streaming consult bru file is needed for completeness.

---

## 8. Non-Streaming Consult (Same Endpoint)

**Finding**: The spec modifies the consult endpoint to support `stream: true`. But the non-streaming path must also be implemented (it's the current default from ADR-009).

**Decision**: The `ConsultController` handles both modes from a single `POST /consult` route. The `stream` boolean in the request body determines which code path runs in `ConsultService`.

---

## Constitution Checks

| ADR | Status |
|-----|--------|
| ADR-032: Controller = facade | ✅ Controller makes one service call: `service.handle(userId, dto, req, res)` |
| ADR-033: Interface abstraction | ✅ `IAiServiceClient` interface defined before implementation |
| ADR-016: AiServiceClient for forwarding | ✅ First implementation of AiServiceClient in this feature |
| ADR-014: One module per domain | ✅ New `ConsultModule`, new `AiServiceModule` |
| ADR-021: Bruno file required | ✅ Bruno file added in this feature |
| ADR-017: Global ValidationPipe | ✅ DTO uses class-validator decorators |
| ADR-003: YAML config for non-secrets | ✅ ai_service.base_url added to YAML |
| ADR-009: SSE as planned streaming mode | ✅ This feature implements what ADR-009 documented |
