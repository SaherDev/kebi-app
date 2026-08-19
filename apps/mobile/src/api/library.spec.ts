import {
  deleteUserPlace,
  getLibrary,
  getLibraryAreas,
  libraryQueryString,
  saveUserPlace,
  updateUserPlace,
} from './library';
import { API_ROUTES } from './routes';
import { LibraryResponse, UserPlace } from './models/library';
import { SchemaValidationError } from './validate';
import { makeFakeClient } from '../test-utils/fake-http-client';
import type { HttpClient } from './types';

const PLACE = {
  id: 'c0ffee00-1111-2222-3333-444455556666',
  provider_id: null,
  place_name: 'Kamachiku',
  place_name_aliases: [],
  categories: ['restaurant'],
  tags: [{ type: 'cuisine', value: 'Japanese', source: 'google' }],
  location: null,
  created_at: null,
  refreshed_at: null,
};

const USER_DATA = {
  user_place_id: '9b1c',
  place_id: 'c0ffee00-1111-2222-3333-444455556666',
  approved: false,
  visited: true,
  liked: null,
  note: null,
  source: 'tiktok',
  source_ref: 'https://www.tiktok.com/@onlyfoodsushi/video/123',
  source_label: null,
  saved_at: '2026-05-01T08:00:00Z',
  visited_at: null,
};

const AREA = {
  key: 'id/bali/canggu',
  name: 'Canggu',
  uri: 'kebi://area/aWQvYmFsaS9jYW5nZ3U',
  icon: '🏄',
  parent: { key: 'id/bali', name: 'Bali', uri: 'kebi://area/aWQvYmFsaQ', icon: null },
};

const LIBRARY = {
  places: [{ place: PLACE, user_data: USER_DATA }],
  next_cursor: 'eyJ0cyI6',
};

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
    delete: async (path: string) => {
      calls.push({ method: 'DELETE', path });
    },
    postStream: async function* () {
      // not exercised by library tests
    },
  };
}

describe('libraryQueryString', () => {
  it('is empty for no params', () => {
    expect(libraryQueryString({})).toBe('');
  });

  it('serialises search + area + paging, omitting unset', () => {
    expect(
      libraryQueryString({ q: 'cang', area: 'id/bali', limit: 20, cursor: 'abc' }),
    ).toBe('?q=cang&area=id%2Fbali&limit=20&cursor=abc');
  });

  it('drops a blank query rather than searching for nothing', () => {
    expect(libraryQueryString({ q: '' })).toBe('');
  });
});

describe('getLibrary', () => {
  it('GETs the library route with the query string', async () => {
    const client = fakeClient(LIBRARY);
    await getLibrary(client, { q: 'cang', limit: 50 });

    expect(client.calls).toEqual([
      { method: 'GET', path: `${API_ROUTES.library}?q=cang&limit=50` },
    ]);
  });

  it('validates into a LibraryResponse instance', async () => {
    const res = await getLibrary(fakeClient(LIBRARY));

    expect(res).toBeInstanceOf(LibraryResponse);
    expect(res.places).toHaveLength(1);
    expect(res.places[0].place.place_name).toBe('Kamachiku');
    expect(res.places[0].user_data.visited).toBe(true);
    expect(res.next_cursor).toBe('eyJ0cyI6');
  });

  it('reads filtered_total and the row area, tolerating their absence', async () => {
    const withArea = await getLibrary(
      fakeClient({
        ...LIBRARY,
        filtered_total: 3,
        places: [{ place: PLACE, user_data: USER_DATA, area: AREA }],
      }),
    );

    expect(withArea.filtered_total).toBe(3);
    expect(withArea.places[0].area?.key).toBe('id/bali/canggu');
    expect(withArea.places[0].area?.parent?.name).toBe('Bali');

    // A place coarser than a city (and a pre-ADR-165 kebi) both read as null.
    const without = await getLibrary(fakeClient(LIBRARY));
    expect(without.filtered_total).toBeNull();
    expect(without.places[0].area).toBeNull();
  });

  it('fails closed on schema drift', async () => {
    await expect(getLibrary(fakeClient({ places: 'nope' }))).rejects.toBeInstanceOf(
      SchemaValidationError,
    );
  });
});

describe('getLibraryAreas', () => {
  it('GETs the distribution route and validates it', async () => {
    const client = fakeClient({ areas: [{ area: AREA, count: 11 }] });
    const res = await getLibraryAreas(client);

    expect(client.calls).toEqual([{ method: 'GET', path: API_ROUTES.libraryAreas }]);
    expect(res.areas).toHaveLength(1);
    expect(res.areas[0].count).toBe(11);
    expect(res.areas[0].area.uri).toBe('kebi://area/aWQvYmFsaS9jYW5nZ3U');
  });

  it('treats a missing areas list as no areas', async () => {
    expect((await getLibraryAreas(fakeClient({}))).areas).toEqual([]);
  });
});

describe('saveUserPlace', () => {
  it('POSTs the save body and returns the created user-state', async () => {
    const client = makeFakeClient({ payload: USER_DATA });
    const res = await saveUserPlace(client, {
      place_core_id: 'c0ffee00-1111-2222-3333-444455556666',
      recommendation_id: 'rec_1',
    });

    expect(client.calls).toEqual([
      {
        method: 'POST',
        path: API_ROUTES.userPlaces,
        body: {
          place_core_id: 'c0ffee00-1111-2222-3333-444455556666',
          recommendation_id: 'rec_1',
        },
      },
    ]);
    expect(res).toBeInstanceOf(UserPlace);
    expect(res.user_place_id).toBe('9b1c');
  });

  it('fails closed on schema drift', async () => {
    const client = makeFakeClient({ payload: { nope: true } });
    await expect(
      saveUserPlace(client, { place_core_id: 'x', recommendation_id: 'rec_1' }),
    ).rejects.toBeInstanceOf(SchemaValidationError);
  });
});

describe('updateUserPlace', () => {
  it('PATCHes the place route with the partial body and returns the new state', async () => {
    const client = fakeClient({ ...USER_DATA, visited: false });
    const res = await updateUserPlace(client, '9b1c', { visited: false });

    expect(client.calls).toEqual([
      { method: 'PATCH', path: API_ROUTES.userPlace('9b1c'), body: { visited: false } },
    ]);
    expect(res).toBeInstanceOf(UserPlace);
    expect(res.visited).toBe(false);
  });
});

describe('deleteUserPlace', () => {
  it('DELETEs the place route', async () => {
    const client = fakeClient(undefined);
    await deleteUserPlace(client, '9b1c');

    expect(client.calls).toEqual([{ method: 'DELETE', path: API_ROUTES.userPlace('9b1c') }]);
  });
});
