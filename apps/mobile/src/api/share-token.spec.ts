import { mintShareToken, SHARE_TOKEN_RENEW_WITHIN_MS } from './share-token';
import { API_ROUTES } from './routes';
import { ShareToken } from './models/share-token';
import { SchemaValidationError } from './validate';
import { HttpError } from './transports/fetch.transport';
import type { HttpClient } from './types';

type Call = { method: string; path: string; body?: unknown };

function fakeClient(result: unknown | (() => never)): HttpClient & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    get: async () => undefined as never,
    post: async (path: string, body: unknown) => {
      calls.push({ method: 'POST', path, body });
      if (typeof result === 'function') (result as () => never)();
      return result as never;
    },
    patch: async () => undefined as never,
    delete: async () => undefined,
    postStream: async function* () {
      // unused
    },
  };
}

const VALID = { token: 'kst_body.sig', expires_at: Date.now() + 90 * 86_400_000 };

describe('mintShareToken', () => {
  it('POSTs the mint route and validates into an instance', async () => {
    const client = fakeClient(VALID);

    const res = await mintShareToken(client);

    expect(client.calls).toEqual([
      { method: 'POST', path: API_ROUTES.shareToken, body: {} },
    ]);
    expect(res).toBeInstanceOf(ShareToken);
    expect(res?.token).toBe('kst_body.sig');
  });

  it('returns null when the gateway has no secret configured (503)', async () => {
    // A deployment state, not a user-facing failure: the caller carries on and
    // the extension falls back to queueing.
    const client = fakeClient(() => {
      throw new HttpError(503, 'Service Unavailable');
    });

    await expect(mintShareToken(client)).resolves.toBeNull();
  });

  it('rethrows any other transport failure', async () => {
    const client = fakeClient(() => {
      throw new HttpError(401, 'Unauthorized');
    });

    await expect(mintShareToken(client)).rejects.toBeInstanceOf(HttpError);
  });

  it('fails closed on a response that is not a share token', async () => {
    const client = fakeClient({ token: '', expires_at: 'soon' });

    await expect(mintShareToken(client)).rejects.toBeInstanceOf(SchemaValidationError);
  });
});

describe('ShareToken.needsRenewal', () => {
  const now = 1_000_000_000_000;

  it('is false for a freshly minted token', () => {
    const token = new ShareToken({ token: 'kst_x', expires_at: now + 90 * 86_400_000 });
    expect(token.needsRenewal(SHARE_TOKEN_RENEW_WITHIN_MS, now)).toBe(false);
  });

  it('is true inside the renewal window, before the token has actually lapsed', () => {
    const token = new ShareToken({ token: 'kst_x', expires_at: now + 86_400_000 });
    expect(token.needsRenewal(SHARE_TOKEN_RENEW_WITHIN_MS, now)).toBe(true);
  });

  it('is true for an already-expired token', () => {
    const token = new ShareToken({ token: 'kst_x', expires_at: now - 1 });
    expect(token.needsRenewal(SHARE_TOKEN_RENEW_WITHIN_MS, now)).toBe(true);
  });
});
