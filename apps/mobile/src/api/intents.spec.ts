import { getIntents, intentsQueryString } from './intents';
import { API_ROUTES } from './routes';
import { IntentsResponse } from './models/intents';
import { SchemaValidationError } from './validate';
import type { HttpClient } from './types';

const INTENTS = {
  intents: [
    { id: '9f1c', text: "coffee, quiet, nowhere i've been", created_at: '2026-06-27T08:42:00Z' },
  ],
  next_cursor: 'eyJ0cyI6',
};

type Call = { method: string; path: string };

function fakeClient(payload: unknown): HttpClient & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    get: async (path: string) => {
      calls.push({ method: 'GET', path });
      return payload as never;
    },
    post: async () => undefined as never,
    patch: async () => undefined as never,
    delete: async () => undefined,
    postStream: async function* () {
      // unused here
    },
  };
}

describe('intentsQueryString', () => {
  it('is empty for no params', () => {
    expect(intentsQueryString({})).toBe('');
  });

  it('serialises limit + cursor, omitting unset', () => {
    expect(intentsQueryString({ limit: 20, cursor: 'abc' })).toBe('?limit=20&cursor=abc');
  });
});

describe('getIntents', () => {
  it('GETs the intents route with the query string', async () => {
    const client = fakeClient(INTENTS);
    await getIntents(client, { limit: 3 });

    expect(client.calls).toEqual([
      { method: 'GET', path: `${API_ROUTES.userIntents}?limit=3` },
    ]);
  });

  it('validates into an IntentsResponse instance', async () => {
    const res = await getIntents(fakeClient(INTENTS));

    expect(res).toBeInstanceOf(IntentsResponse);
    expect(res.intents).toHaveLength(1);
    expect(res.intents[0].text).toBe("coffee, quiet, nowhere i've been");
    expect(res.intents[0].created_at).toBe('2026-06-27T08:42:00Z');
    expect(res.next_cursor).toBe('eyJ0cyI6');
  });

  it('reads the empty-history shape', async () => {
    const res = await getIntents(fakeClient({ intents: [], next_cursor: null }));
    expect(res.intents).toEqual([]);
    expect(res.next_cursor).toBeNull();
  });

  it('fails closed on schema drift', async () => {
    await expect(getIntents(fakeClient({ intents: 'nope' }))).rejects.toBeInstanceOf(
      SchemaValidationError,
    );
  });
});
