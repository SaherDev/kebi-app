import { enrichLocation } from './location';

const URL_ENV = 'NEXT_PUBLIC_REVERSE_GEOCODE_URL';
const LANG_ENV = 'NEXT_PUBLIC_REVERSE_GEOCODE_LANGUAGE';
const ENDPOINT = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

// Synthetic fixtures shaped like a BigDataCloud response (no real
// places/coords). DISTINCT_LOCALITY: locality differs from city, so
// locality IS the neighborhood. SAME_LOCALITY: locality equals city, so
// there is no neighborhood data.
const DISTINCT_LOCALITY = {
  latitude: 10,
  longitude: 20,
  city: 'Cityville',
  locality: 'Old Quarter',
  principalSubdivision: 'Region One',
  countryCode: 'ZZ',
  countryName: 'Testland',
};

const SAME_LOCALITY = {
  latitude: 30,
  longitude: 40,
  city: 'Townsburg',
  locality: 'Townsburg',
  principalSubdivision: 'Region Two',
  countryCode: 'ZZ',
  countryName: 'Testland',
};

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('enrichLocation', () => {
  const originalFetch = global.fetch;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env[URL_ENV] = ENDPOINT;
    process.env[LANG_ENV] = 'en';
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('locality differs from city → neighborhood is the locality', async () => {
    const fetchMock = mockFetchOnce(DISTINCT_LOCALITY);

    const result = await enrichLocation(10, 20);

    expect(result).toEqual({
      lat: 10,
      lng: 20,
      context: {
        city: 'Cityville',
        neighborhood: 'Old Quarter',
        district: 'Region One',
        countryCode: 'ZZ',
        countryName: 'Testland',
      },
    });

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain(ENDPOINT);
    expect(calledUrl).toContain('latitude=10');
    expect(calledUrl).toContain('longitude=20');
    expect(calledUrl).toContain('localityLanguage=en');
  });

  it('locality equals city → neighborhood is null', async () => {
    mockFetchOnce(SAME_LOCALITY);

    const result = await enrichLocation(30, 40);

    expect(result.context).toEqual({
      city: 'Townsburg',
      neighborhood: null,
      district: 'Region Two',
      countryCode: 'ZZ',
      countryName: 'Testland',
    });
  });

  it('non-200 → context: null, logs a warning, does not throw', async () => {
    mockFetchOnce({}, false, 403);

    await expect(enrichLocation(1, 2)).resolves.toEqual({
      lat: 1,
      lng: 2,
      context: null,
    });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('network error → context: null, logs a warning', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const result = await enrichLocation(5, 6);

    expect(result.context).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('aborts and returns null when the request exceeds the timeout', async () => {
    // fetch that rejects with an AbortError once the controller fires.
    global.fetch = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    ) as unknown as typeof fetch;

    jest.useFakeTimers();
    const promise = enrichLocation(9, 10);
    jest.advanceTimersByTime(3000);
    const result = await promise;
    jest.useRealTimers();

    expect(result).toEqual({ lat: 9, lng: 10, context: null });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('skips the network call when the endpoint env var is unset', async () => {
    delete process.env[URL_ENV];
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await enrichLocation(7, 8);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ lat: 7, lng: 8, context: null });
    expect(warnSpy).toHaveBeenCalled();
  });
});
