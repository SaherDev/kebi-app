import { getUserSettings, updateAboutMe, updateMovementProfile } from './user-settings';
import { API_ROUTES } from './routes';
import { MovementProfile, UserAboutMe, UserSettings } from './models/user-settings';
import { SchemaValidationError } from './validate';
import type { HttpClient } from './types';

const ABOUT_ME = { call_me: 'Saher', home_country: 'AE', about: "I don't drink." };
const MOVEMENT = { available_modes: ['driving'], reach: 'far', source: 'user' };

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

describe('getUserSettings', () => {
  it('GETs the settings route and validates into class instances', async () => {
    const client = fakeClient({ about_me: ABOUT_ME, movement_profile: MOVEMENT });
    const res = await getUserSettings(client);

    expect(client.calls).toEqual([{ method: 'GET', path: API_ROUTES.userSettings }]);
    expect(res).toBeInstanceOf(UserSettings);
    expect(res.about_me).toBeInstanceOf(UserAboutMe);
    expect(res.movement_profile).toBeInstanceOf(MovementProfile);
  });

  it('accepts both blocks null — the never-set user', async () => {
    const res = await getUserSettings(fakeClient({ about_me: null, movement_profile: null }));

    expect(res.about_me).toBeNull();
    expect(res.movement_profile).toBeNull();
  });

  it('reads a seeded profile as not chosen, so the row cannot claim a choice', async () => {
    const res = await getUserSettings(
      fakeClient({
        about_me: null,
        movement_profile: { available_modes: ['walking', 'transit'], reach: 'normal', source: 'default' },
      }),
    );

    expect(res.movement_profile?.isChosen).toBe(false);
  });

  it('treats a source-less profile as not chosen (row predating kebi ADR-155)', async () => {
    const res = await getUserSettings(
      fakeClient({
        about_me: null,
        movement_profile: { available_modes: ['walking'], reach: 'normal' },
      }),
    );

    expect(res.movement_profile?.isChosen).toBe(false);
  });

  it('fails closed on schema drift (unknown movement mode)', async () => {
    await expect(
      getUserSettings(
        fakeClient({
          about_me: null,
          movement_profile: { available_modes: ['teleport'], reach: 'normal' },
        }),
      ),
    ).rejects.toBeInstanceOf(SchemaValidationError);
  });
});

describe('UserAboutMe.isEmpty', () => {
  it('is empty only when every field is null', async () => {
    const empty = await getUserSettings(
      fakeClient({
        about_me: { call_me: null, home_country: null, about: null },
        movement_profile: null,
      }),
    );
    const named = await getUserSettings(
      fakeClient({
        about_me: { call_me: 'Saher', home_country: null, about: null },
        movement_profile: null,
      }),
    );

    expect(empty.about_me?.isEmpty).toBe(true);
    expect(named.about_me?.isEmpty).toBe(false);
  });
});

describe('updateAboutMe', () => {
  it('PATCHes all three fields — the write is whole-block', async () => {
    const client = fakeClient(ABOUT_ME);
    const res = await updateAboutMe(client, {
      call_me: 'Saher',
      home_country: 'AE',
      about: "I don't drink.",
    });

    expect(client.calls).toEqual([
      {
        method: 'PATCH',
        path: API_ROUTES.userAboutMe,
        body: { call_me: 'Saher', home_country: 'AE', about: "I don't drink." },
      },
    ]);
    expect(res).toBeInstanceOf(UserAboutMe);
  });

  it('sends empty strings for cleared fields rather than omitting them', async () => {
    const client = fakeClient({ call_me: null, home_country: null, about: null });
    await updateAboutMe(client, { call_me: '', home_country: null, about: '' });

    expect(client.calls[0].body).toEqual({ call_me: '', home_country: null, about: '' });
  });
});

describe('updateMovementProfile', () => {
  it('PATCHes modes + reach and never sends source — the gateway stamps it', async () => {
    const client = fakeClient(MOVEMENT);
    const res = await updateMovementProfile(client, {
      available_modes: ['driving'],
      reach: 'far',
    });

    expect(client.calls).toEqual([
      {
        method: 'PATCH',
        path: API_ROUTES.userMovement,
        body: { available_modes: ['driving'], reach: 'far' },
      },
    ]);
    expect(res.isChosen).toBe(true);
  });
});
