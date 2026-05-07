# Research: AI Service Client — Migrate to Axios and Add extractPlace

**Generated**: 2026-03-25
**Branch**: `001-ai-service-axios`

---

## Decision 1: @nestjs/axios — Installation Required

**Decision**: Add `@nestjs/axios` to `services/api/package.json` dependencies.

**Rationale**: `@nestjs/axios` is not currently installed. It provides `HttpModule` and `HttpService`, which wrap Axios in NestJS's DI system. This is the package mandated by ADR-016.

**How to install**: `pnpm --filter @kebi-app/api add @nestjs/axios axios`

Note: `axios` itself may also need to be installed as a peer — verify after `@nestjs/axios` installs.

---

## Decision 2: Observable → Promise Bridging

**Decision**: Use `firstValueFrom()` from `rxjs` to bridge `HttpService`'s `Observable<AxiosResponse<T>>` return type to `Promise<T>`.

**Rationale**: `firstValueFrom()` is the idiomatic rxjs 7 replacement for `.toPromise()` (deprecated). `rxjs` 7.8.0 is already installed. `lastValueFrom()` is semantically wrong for single HTTP calls — `firstValueFrom()` completes as soon as the first emission arrives, which is exactly one HTTP response.

**Alternatives considered**:
- `.toPromise()` — deprecated in rxjs 7, do not use
- `lastValueFrom()` — correct but semantically less clear for single responses
- Keeping Observable-based API — would require changing the interface signature, violating FR-009 (no call site changes)

---

## Decision 3: Streaming with Axios

**Decision**: Use `{ responseType: 'stream' }` in the Axios request config passed to `HttpService.post()`. Extract the raw stream from `response.data` (which is a `Readable` when `responseType: 'stream'`).

**Rationale**: Axios supports `responseType: 'stream'` which instructs it to return a Node.js `Readable` stream as `response.data`. This preserves the `Readable` return type expected by `consultStream()` callers (FR-008).

**Implementation pattern**:
```
const response = await firstValueFrom(
  httpService.post(url, body, { responseType: 'stream', timeout: 20000 })
);
return response.data; // This is a Readable stream
```

**Alternatives considered**:
- Returning the `Observable` directly — changes the interface return type, breaks callers
- Using `axios` directly instead of `HttpService` — bypasses NestJS DI, violates ADR-016

---

## Decision 4: Timeout Configuration

**Decision**: Use `20000` ms (20s) for `consult()` and `consultStream()`, and `10000` ms (10s) for `extractPlace()`.

**Rationale**: Constitution Section VI explicitly sets consult timeout to 20s, and ADR-016 states "10s for extract-place, 20s for consult". The api-contract.md mentions "30 seconds for all AI service calls" as the global HTTP client timeout, but Section VI of the constitution takes precedence over the api-contract note. The spec FR-007 (30s) contains an error — it contradicts ADR-016 and the constitution. **The spec should be corrected to 20s for consult.** This is flagged as a spec correction to apply during implementation.

**Timeout is passed via Axios config**: `{ timeout: 10000 }` / `{ timeout: 20000 }` in the request options.

---

## Decision 5: Error Pass-Through (Option B)

**Decision**: Let `AxiosError` propagate raw from all three client methods. No try/catch for HTTP errors. No `normalizeError()` helper.

**Rationale**: Corrected decision (2026-03-25). The `AllExceptionsFilter` (ADR-018) will handle `AxiosError` centrally in a subsequent task. Normalizing at the client level would duplicate error-handling logic and undermine the filter's role. Option B defers error translation to the right layer.

**Implementation pattern**: No error wrapping — simply `return response.data` after `firstValueFrom()`. Axios throws on non-2xx automatically; those errors reach callers as `AxiosError` instances with `.response.status` and `.response.data` available for the filter to inspect.

Note: `isAxiosError` import is **not needed** in this task.

---

## Decision 6: Existing Test Update Required

**Decision**: The existing `ai-service.client.spec.ts` must be updated — it directly instantiates `new AiServiceClient(configService)`, which will break when `HttpService` is added to the constructor.

**Rationale**: The test bypasses NestJS DI by calling the constructor directly. After migration, the constructor signature becomes `AiServiceClient(configService: ConfigService, httpService: HttpService)`. The test must provide a mock `HttpService`.

**Mock pattern for HttpService**:
```typescript
const mockHttpService = {
  post: jest.fn(),
} as unknown as HttpService;

client = new AiServiceClient(configService, mockHttpService);
```

The mock `post()` should return an `Observable` wrapping the desired response using `of(...)` from rxjs.

---

## Resolved Unknowns

| Unknown | Resolution |
|---------|-----------|
| Is @nestjs/axios installed? | No — must be installed via pnpm |
| How to convert Observable to Promise? | `firstValueFrom()` from rxjs 7 |
| How to stream with Axios? | `responseType: 'stream'` → `response.data` is Readable |
| Consult timeout: 20s or 30s? | 20s per constitution VI and ADR-016 |
| Error shape for non-2xx? | Pass-through — AxiosError propagates raw; AllExceptionsFilter handles it later |
| Do existing tests break? | Yes — must mock HttpService in constructor |
