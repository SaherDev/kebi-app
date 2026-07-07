import { changePlan } from './plan';
import { API_ROUTES } from './routes';
import { UserProfile } from './models/profile';
import { SchemaValidationError } from './validate';
import type { HttpClient } from './types';

type Call = { method: string; path: string; body?: unknown };

function fakeClient(payload: unknown): HttpClient & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    get: async () => undefined as never,
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

describe('changePlan', () => {
  it('PATCHes the plan route and validates the echoed profile into an instance', async () => {
    const client = fakeClient({ name: 'saher', email: 'saher@kebi.app', plan: 'explorer' });

    const res = await changePlan(client, 'explorer');

    expect(client.calls).toEqual([
      { method: 'PATCH', path: API_ROUTES.userPlan, body: { plan: 'explorer' } },
    ]);
    expect(res).toBeInstanceOf(UserProfile);
    expect(res.plan).toBe('explorer');
  });

  it('fails closed on schema drift (unknown plan echoed back)', async () => {
    await expect(
      changePlan(fakeClient({ name: 'x', email: 'y', plan: 'galaxy_brain' }), 'explorer'),
    ).rejects.toBeInstanceOf(SchemaValidationError);
  });
});
