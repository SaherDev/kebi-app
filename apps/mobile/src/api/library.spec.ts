import { deleteUserPlace, getLibrary, libraryQueryString, updateUserPlace } from './library';
import { API_ROUTES } from './routes';
import { LibraryResponse, UserPlace } from './models/library';
import { SchemaValidationError } from './validate';
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
  };
}

describe('libraryQueryString', () => {
  it('is empty for no params', () => {
    expect(libraryQueryString({})).toBe('');
  });

  it('serialises sort + filter + paging, omitting unset', () => {
    expect(libraryQueryString({ sort: 'name', approved: false, limit: 20, cursor: 'abc' })).toBe(
      '?sort=name&approved=false&limit=20&cursor=abc',
    );
  });

  it('keeps visited=false (not dropped as falsy)', () => {
    expect(libraryQueryString({ visited: false })).toBe('?visited=false');
  });
});

describe('getLibrary', () => {
  it('GETs the library route with the query string', async () => {
    const client = fakeClient(LIBRARY);
    await getLibrary(client, { sort: 'recent', limit: 50 });

    expect(client.calls).toEqual([
      { method: 'GET', path: `${API_ROUTES.library}?sort=recent&limit=50` },
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

  it('fails closed on schema drift', async () => {
    await expect(getLibrary(fakeClient({ places: 'nope' }))).rejects.toBeInstanceOf(
      SchemaValidationError,
    );
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
