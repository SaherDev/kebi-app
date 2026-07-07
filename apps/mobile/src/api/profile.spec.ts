import { getProfile, updateProfile } from './profile';
import { API_ROUTES } from './routes';
import { UserProfile } from './models/profile';
import { SchemaValidationError } from './validate';
import type { HttpClient } from './types';

const PROFILE = { name: 'saher', email: 'saher@kebi.app', plan: 'local_legend' };

type Call = { method: string; path: string; body?: unknown };

function fakeClient(payload: unknown): HttpClient & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    get: async (path: string) => {
      calls.push({ method: 'GET', path });
      return payload as never;
    },
    post: async () => undefined as never,
    patch: async (path: string, body: unknown) => {
      calls.push({ method: 'PATCH', path, body });
      return payload as never;
    },
    delete: async () => undefined,
    postStream: async function* () {
      // unused
    },
  };
}

describe('getProfile', () => {
  it('GETs the profile route and validates into a UserProfile instance', async () => {
    const client = fakeClient(PROFILE);
    const res = await getProfile(client);

    expect(client.calls).toEqual([{ method: 'GET', path: API_ROUTES.userProfile }]);
    expect(res).toBeInstanceOf(UserProfile);
    expect(res).toMatchObject({ name: 'saher', email: 'saher@kebi.app', plan: 'local_legend' });
  });

  it('accepts empty name/email (phone-only signup)', async () => {
    const res = await getProfile(fakeClient({ name: '', email: '', plan: 'homebody' }));
    expect(res.name).toBe('');
    expect(res.email).toBe('');
  });

  it('fails closed on schema drift (unknown plan)', async () => {
    await expect(
      getProfile(fakeClient({ name: 'x', email: 'y', plan: 'galaxy_brain' })),
    ).rejects.toBeInstanceOf(SchemaValidationError);
  });
});

describe('updateProfile', () => {
  it('PATCHes the name and validates the echoed profile', async () => {
    const client = fakeClient({ ...PROFILE, name: 'new name' });
    const res = await updateProfile(client, 'new name');

    expect(client.calls).toEqual([
      { method: 'PATCH', path: API_ROUTES.userProfile, body: { name: 'new name' } },
    ]);
    expect(res).toBeInstanceOf(UserProfile);
    expect(res.name).toBe('new name');
  });
});
