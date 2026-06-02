import { HttpClient } from '../types';

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
 * (available in Expo 54 / RN 0.81 — no polyfill needed) and attaches a
 * Bearer token from the injected `getToken` getter on every request.
 *
 * Pure transport: no location injection (that is a web-only concern) and
 * no streaming (`postStream`/SSE is deferred to the chat task, which will
 * use `expo/fetch`).
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

  async delete(path: string): Promise<void> {
    const res = await this.fetch(path, { method: 'DELETE' });
    if (!res.ok) {
      throw new HttpError(res.status, res.statusText, await this.errorBody(res));
    }
  }

  private async request<T>(path: string, options: RequestInit): Promise<T> {
    const res = await this.fetch(path, options);

    if (!res.ok) {
      throw new HttpError(res.status, res.statusText, await this.errorBody(res));
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
