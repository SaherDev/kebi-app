/**
 * HTTP client interface — the swappable transport seam (Strategy pattern).
 * All API calls from apps/mobile go through this interface; concrete
 * transports (fetch, axios, …) live in ./transports and are injected at
 * the edge. Nothing outside ./api imports a transport directly.
 */
export interface HttpClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T>;
  delete(path: string): Promise<void>;
}
