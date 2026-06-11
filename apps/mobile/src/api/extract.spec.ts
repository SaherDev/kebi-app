import { extractPlace } from './extract';
import { API_ROUTES } from './routes';
import { ExtractPlaceResponse } from './models/extract';
import { SchemaValidationError } from './validate';
import type { HttpClient } from './types';

const PLACE = {
  id: 'c0ffee00-1111-2222-3333-444455556666',
  provider_id: null,
  place_name: 'Nara Eatery',
  place_name_aliases: [],
  categories: ['restaurant'],
  tags: [],
  location: null,
  created_at: null,
  refreshed_at: null,
};

const COMPLETED = {
  status: 'completed',
  results: [{ place: PLACE, confidence: 0.82 }],
  raw_input: 'https://www.tiktok.com/@user/video/123',
  request_id: '9f1c',
  failure_reason: null,
  failure_message: null,
};

const FAILED = {
  status: 'failed',
  results: [],
  raw_input: 'https://tiktok.com.evil.tld/x',
  request_id: '9f1d',
  failure_reason: 'unsupported_url',
  failure_message: 'That link host is not supported',
};

// A fake transport: returns a queued payload and records the call args.
function fakeClient(payload: unknown): HttpClient & { calls: { path: string; body: unknown }[] } {
  const calls: { path: string; body: unknown }[] = [];
  return {
    calls,
    get: async () => undefined as never,
    delete: async () => undefined,
    patch: async () => undefined as never,
    post: async (path: string, body: unknown) => {
      calls.push({ path, body });
      return payload as never;
    },
  };
}

describe('extractPlace', () => {
  it('POSTs to the extract route with only { raw_input } (no source)', async () => {
    const client = fakeClient(COMPLETED);
    await extractPlace(client, 'coco tam koh samui');

    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].path).toBe(API_ROUTES.extract);
    expect(client.calls[0].body).toEqual({ raw_input: 'coco tam koh samui' });
  });

  it('validates a completed response into an ExtractPlaceResponse instance', async () => {
    const res = await extractPlace(fakeClient(COMPLETED), 'x');

    expect(res).toBeInstanceOf(ExtractPlaceResponse);
    expect(res.status).toBe('completed');
    expect(res.results).toHaveLength(1);
    expect(res.results[0].place.place_name).toBe('Nara Eatery');
  });

  it('returns a failed envelope carrying its failure_reason (200, not a throw)', async () => {
    const res = await extractPlace(fakeClient(FAILED), 'https://tiktok.com.evil.tld/x');

    expect(res.status).toBe('failed');
    expect(res.results).toHaveLength(0);
    expect(res.failure_reason).toBe('unsupported_url');
  });

  it('fails closed on schema drift', async () => {
    await expect(extractPlace(fakeClient({ status: 'completed' }), 'x')).rejects.toBeInstanceOf(
      SchemaValidationError,
    );
  });
});
