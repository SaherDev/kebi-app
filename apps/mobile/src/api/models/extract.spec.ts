import {
  ExtractPlaceResponse,
  ExtractPlaceResponseSchema,
  ExtractPlaceResult,
} from './extract';
import { PlaceCore } from './place-core';

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

// `completed` envelope per docs/api-contract.md → POST /v1/extract.
const COMPLETED_FIXTURE = {
  status: 'completed',
  results: [{ place: PLACE, confidence: 0.82 }],
  raw_input: 'https://www.tiktok.com/@user/video/123',
  request_id: '9f1c',
  failure_reason: null,
  failure_message: null,
};

const FAILED_FIXTURE = {
  status: 'failed',
  results: [],
  raw_input: 'https://tiktok.com.evil.tld/x',
  request_id: '9f1d',
  failure_reason: 'unsupported_url',
  failure_message: 'That link host is not supported',
};

describe('ExtractPlaceResponseSchema', () => {
  it('parses a completed extraction with a PlaceCore result', () => {
    const res = ExtractPlaceResponseSchema.parse(COMPLETED_FIXTURE);

    expect(res).toBeInstanceOf(ExtractPlaceResponse);
    expect(res.status).toBe('completed');
    expect(res.results[0]).toBeInstanceOf(ExtractPlaceResult);
    expect(res.results[0].confidence).toBe(0.82);
    expect(res.results[0].place).toBeInstanceOf(PlaceCore);
  });

  it('parses a failed extraction carrying a failure_reason', () => {
    const res = ExtractPlaceResponseSchema.parse(FAILED_FIXTURE);

    expect(res.status).toBe('failed');
    expect(res.results).toHaveLength(0);
    expect(res.failure_reason).toBe('unsupported_url');
  });
});
