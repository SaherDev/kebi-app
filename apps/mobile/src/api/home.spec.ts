import { getHome, homeQueryString } from './home';
import { API_ROUTES } from './routes';
import { HomeResponse } from './models/home';
import { SchemaValidationError } from './validate';
import type { HttpClient } from './types';

const HOME = {
  greeting: "it's late, drunk food?",
  chips: [{ text: 'ramen, no line' }, { text: 'surprise me' }],
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

describe('homeQueryString', () => {
  it('is empty for no context', () => {
    expect(homeQueryString({})).toBe('');
  });

  it('serialises the supplied context, omitting unset', () => {
    expect(
      homeQueryString({ lat: 35.6615, lng: 139.668, city: 'shimokitazawa', weather: 'clear' }),
    ).toBe('?lat=35.6615&lng=139.668&city=shimokitazawa&weather=clear');
  });

  it('keeps lat=0 (not dropped as falsy)', () => {
    expect(homeQueryString({ lat: 0 })).toBe('?lat=0');
  });
});

describe('getHome', () => {
  it('GETs the home route with the context query', async () => {
    const client = fakeClient(HOME);
    await getHome(client, { city: 'shimokitazawa', weather: 'clear' });

    expect(client.calls).toEqual([
      { method: 'GET', path: `${API_ROUTES.home}?city=shimokitazawa&weather=clear` },
    ]);
  });

  it('validates into a HomeResponse instance', async () => {
    const res = await getHome(fakeClient(HOME));

    expect(res).toBeInstanceOf(HomeResponse);
    expect(res.greeting).toBe("it's late, drunk food?");
    expect(res.chips.map((c) => c.text)).toEqual(['ramen, no line', 'surprise me']);
  });

  it('fails closed on schema drift', async () => {
    await expect(getHome(fakeClient({ greeting: 5, chips: [] }))).rejects.toBeInstanceOf(
      SchemaValidationError,
    );
  });
});
