import type { SseEvent } from '@kebi-app/shared';
import type { HttpClient } from '../api/types';

/** One recorded transport call (method + path + body). */
export interface FakeCall {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'POST_STREAM';
  path: string;
  body?: unknown;
}

export interface FakeClientOptions {
  /** Value the unary verbs (get/post/patch) resolve to. */
  payload?: unknown;
  /** Frames `postStream` yields — an array, or a factory for custom control. */
  stream?: SseEvent[] | (() => AsyncIterable<SseEvent>);
}

/**
 * A fake {@link HttpClient} for api-module tests: records every call on `calls`
 * and replays a fixed payload / SSE frame sequence. One helper so each spec
 * doesn't hand-roll its own transport stub (and so adding a method to the seam
 * is a one-line change here, not in every spec).
 */
export function makeFakeClient(
  opts: FakeClientOptions = {},
): HttpClient & { calls: FakeCall[] } {
  const calls: FakeCall[] = [];
  const { payload, stream = [] } = opts;
  return {
    calls,
    get: async (path) => {
      calls.push({ method: 'GET', path });
      return payload as never;
    },
    post: async (path, body) => {
      calls.push({ method: 'POST', path, body });
      return payload as never;
    },
    patch: async (path, body) => {
      calls.push({ method: 'PATCH', path, body });
      return payload as never;
    },
    delete: async (path) => {
      calls.push({ method: 'DELETE', path });
    },
    async *postStream(path, body) {
      calls.push({ method: 'POST_STREAM', path, body });
      // `for await` consumes both the array and the async-iterable forms.
      const frames = typeof stream === 'function' ? stream() : stream;
      for await (const ev of frames) yield ev;
    },
  };
}
