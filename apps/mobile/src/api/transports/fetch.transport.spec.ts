import { API_ROUTES } from '../routes';
import { FetchClient, HttpError } from './fetch.transport';

const BASE_URL = 'http://localhost:3333/api/v1';

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const fn = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({}),
    ...response,
  });
  // test-setup.ts installs a global fetch mock; override it per test.
  (global as { fetch: unknown }).fetch = fn;
  return fn;
}

describe('FetchClient', () => {
  it('builds the full URL and attaches auth + content-type headers', async () => {
    const fetchMock = mockFetch({ json: async () => ({ status: 'ok' }) });
    const client = new FetchClient(BASE_URL, async () => 'tok-123');

    await client.get(API_ROUTES.health);

    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}${API_ROUTES.health}`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer tok-123',
        }),
      })
    );
  });

  it('returns the parsed JSON body on a 2xx response', async () => {
    mockFetch({ json: async () => ({ status: 'ok' }) });
    const client = new FetchClient(BASE_URL, async () => '');

    await expect(client.get(API_ROUTES.health)).resolves.toEqual({ status: 'ok' });
  });

  it('throws HttpError carrying the status on a non-2xx response', async () => {
    mockFetch({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ detail: 'down' }),
    });
    const client = new FetchClient(BASE_URL, async () => '');

    await expect(client.get(API_ROUTES.health)).rejects.toMatchObject({
      name: 'HttpError',
      status: 503,
      body: { detail: 'down' },
    });
    await expect(client.get(API_ROUTES.health)).rejects.toBeInstanceOf(HttpError);
  });
});
