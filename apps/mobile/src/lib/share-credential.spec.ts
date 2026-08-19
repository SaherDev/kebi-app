import { ensureShareToken, revokeShareToken } from './share-credential';
import { SHARE_TOKEN_RENEW_WITHIN_MS } from '../api/share-token';
import { HttpError } from '../api/transports/fetch.transport';
import type { HttpClient } from '../api/types';

const mockState = {
  available: true,
  expiry: null as number | null,
  stored: [] as Array<{ token: string; expiresAt: number }>,
  baseUrls: [] as string[],
  cleared: 0,
};

jest.mock('./share-storage', () => ({
  canShareInBackground: () => mockState.available,
  storeApiBaseUrl: (url: string) => {
    mockState.baseUrls.push(url);
    return true;
  },
  storedShareTokenExpiry: () => mockState.expiry,
  storeShareToken: (token: string, expiresAt: number) => {
    mockState.stored.push({ token, expiresAt });
    return true;
  },
  clearShareToken: () => {
    mockState.cleared += 1;
  },
}));

function fakeClient(result: unknown | (() => never)): HttpClient & { posts: number } {
  const client = {
    posts: 0,
    get: async () => undefined as never,
    post: async () => {
      client.posts += 1;
      if (typeof result === 'function') (result as () => never)();
      return result as never;
    },
    patch: async () => undefined as never,
    delete: async () => undefined,
    postStream: async function* () {
      // unused
    },
  };
  return client;
}

const FRESH = { token: 'kst_new', expires_at: Date.now() + 90 * 86_400_000 };

beforeEach(() => {
  mockState.available = true;
  mockState.expiry = null;
  mockState.stored = [];
  mockState.baseUrls = [];
  mockState.cleared = 0;
});

describe('ensureShareToken', () => {
  it('mints and stores a token when the extension has none', async () => {
    const client = fakeClient(FRESH);

    await ensureShareToken(client);

    expect(client.posts).toBe(1);
    expect(mockState.stored).toEqual([{ token: 'kst_new', expiresAt: FRESH.expires_at }]);
  });

  it('does nothing when the stored token is still comfortably valid', async () => {
    mockState.expiry = Date.now() + 90 * 86_400_000;
    const client = fakeClient(FRESH);

    await ensureShareToken(client);

    expect(client.posts).toBe(0);
    expect(mockState.stored).toEqual([]);
  });

  it('refreshes the extension’s base URL even when the token needs nothing', async () => {
    // The extension is compiled once; a dev build and a production build point
    // at different gateways, and a stale URL sends saves to the wrong backend.
    mockState.expiry = Date.now() + 90 * 86_400_000;

    await ensureShareToken(fakeClient(FRESH));

    expect(mockState.baseUrls).toEqual([process.env.EXPO_PUBLIC_API_URL]);
  });

  it('renews before expiry, not at it', async () => {
    // Inside the renewal window but not yet lapsed: still works today, would
    // have silently dropped a share next week.
    mockState.expiry = Date.now() + SHARE_TOKEN_RENEW_WITHIN_MS - 1000;
    const client = fakeClient(FRESH);

    await ensureShareToken(client);

    expect(client.posts).toBe(1);
    expect(mockState.stored).toHaveLength(1);
  });

  it('skips entirely when there is no App Group to write to', async () => {
    mockState.available = false;
    const client = fakeClient(FRESH);

    await ensureShareToken(client);

    expect(client.posts).toBe(0);
  });

  it('keeps the existing token when the gateway has no secret configured', async () => {
    // An old token that still works beats no token at all.
    mockState.expiry = Date.now() + 1000;
    const client = fakeClient(() => {
      throw new HttpError(503, 'Service Unavailable');
    });

    await ensureShareToken(client);

    expect(mockState.stored).toEqual([]);
  });

  it('swallows a transport failure — a share token is never a user-facing error', async () => {
    const client = fakeClient(() => {
      throw new HttpError(500, 'Server Error');
    });

    await expect(ensureShareToken(client)).resolves.toBeUndefined();
    expect(mockState.stored).toEqual([]);
  });
});

describe('revokeShareToken', () => {
  it('clears the only copy the extension can reach', () => {
    revokeShareToken();
    expect(mockState.cleared).toBe(1);
  });

  it('is a no-op without an App Group', () => {
    mockState.available = false;
    revokeShareToken();
    expect(mockState.cleared).toBe(0);
  });
});
