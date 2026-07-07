import { fetch as expoFetch } from 'expo/fetch';
import type { SseEvent } from '@kebi-app/shared';
import { HttpClient } from '../types';
import { parseSseFrames } from './sse-parser';

/**
 * Error thrown by the HTTP transport. Carries the HTTP status so
 * callers can categorise (4xx vs 5xx) without parsing message strings.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body?: Record<string, unknown>
  ) {
    super(`API error: ${status} ${statusText}`);
    this.name = 'HttpError';
  }
}

/**
 * fetch-based HttpClient for React Native. Uses RN's global `fetch`
 * (available in Expo 54 / RN 0.81 — no polyfill needed) for the unary verbs
 * and `expo/fetch` for {@link postStream} (its response body is a streaming
 * `ReadableStream`, which RN's global fetch does not expose). Attaches a
 * Bearer token from the injected `getToken` getter on every request.
 *
 * Pure transport: no location injection (that is a web-only concern). This is
 * the only file that imports `expo/fetch` — the streaming seam stays here.
 */
export class FetchClient implements HttpClient {
  constructor(
    private baseUrl: string,
    private getToken: () => Promise<string>
  ) {}

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  async post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      signal,
    });
  }

  async patch<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
      signal,
    });
  }

  async delete(path: string): Promise<void> {
    const res = await this.fetch(path, { method: 'DELETE' });
    if (!res.ok) {
      throw new HttpError(res.status, res.statusText, await this.errorBody(res));
    }
  }

  async *postStream(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): AsyncIterable<SseEvent> {
    const res = await expoFetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...(await this.buildHeaders()), Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal,
    });

    // Non-2xx: surface as the same HttpError the app already categorises. The
    // body may be JSON (e.g. agent disabled → 400) — read it best-effort.
    if (!res.ok) {
      let parsed: Record<string, unknown> | undefined;
      try {
        parsed = (await res.json()) as Record<string, unknown>;
      } catch {
        parsed = undefined;
      }
      throw new HttpError(res.status, res.statusText, parsed);
    }
    if (!res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const parser = parseSseFrames();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (signal?.aborted) break;
        yield* parser.push(decoder.decode(value, { stream: true }));
      }
      // EOF (possibly without a `done` frame — the consumer finishes on
      // wall-clock): flush any trailing complete frame the buffer still holds.
      yield* parser.flush();
    } finally {
      // Stop the upstream connection on early break / abort / consumer return.
      await reader.cancel().catch(() => undefined);
    }
  }

  private async request<T>(path: string, options: RequestInit): Promise<T> {
    const res = await this.fetch(path, options);

    if (!res.ok) {
      throw new HttpError(res.status, res.statusText, await this.errorBody(res));
    }

    // 204 No Content (e.g. the provisioning call) has no body to parse.
    if (res.status === 204) {
      return undefined as T;
    }

    return res.json();
  }

  private async errorBody(res: Response): Promise<Record<string, unknown> | undefined> {
    try {
      return await res.json();
    } catch {
      // non-JSON error body — leave body undefined
      return undefined;
    }
  }

  private async fetch(path: string, options: RequestInit): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...(await this.buildHeaders()),
        ...options.headers,
      },
    });
  }

  private async buildHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }
}
