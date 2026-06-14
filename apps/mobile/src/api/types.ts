import type { SseEvent } from '@kebi-app/shared';

/**
 * HTTP client interface — the swappable transport seam (Strategy pattern).
 * All API calls from apps/mobile go through this interface; concrete
 * transports (fetch, axios, …) live in ./transports and are injected at
 * the edge. Nothing outside ./api imports a transport directly.
 */
export interface HttpClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T>;
  patch<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T>;
  delete(path: string): Promise<void>;
  /**
   * POST a body and consume a Server-Sent Events response as validated
   * {@link SseEvent}s (POST /chat — the always-streaming chat endpoint,
   * ADR-036). An async generator so the consumer can `for await` and stop
   * early; `signal` aborts the upstream request and ends the iteration.
   * Each yielded frame's `data` is already validated at the boundary
   * (ADR-046) — drift throws rather than reaching the caller.
   */
  postStream(path: string, body: unknown, signal?: AbortSignal): AsyncIterable<SseEvent>;
}
