import { ExtractPlaceResponse, ExtractPlaceResponseSchema } from './models/extract';
import { SchemaValidationError, validate } from './validate';

const COMPLETED = {
  status: 'completed',
  results: [],
  raw_input: 'pad thai near me',
  request_id: 'r1',
  failure_reason: null,
  failure_message: null,
};

describe('validate', () => {
  it('returns the parsed class instance on success', () => {
    const res = validate(ExtractPlaceResponseSchema, COMPLETED, 'ExtractPlaceResponse');

    expect(res).toBeInstanceOf(ExtractPlaceResponse);
    expect(res.status).toBe('completed');
  });

  it('throws a labelled SchemaValidationError on a malformed payload', () => {
    expect(() =>
      validate(ExtractPlaceResponseSchema, { status: 'completed' }, 'ExtractPlaceResponse')
    ).toThrow(SchemaValidationError);

    try {
      validate(ExtractPlaceResponseSchema, { status: 'bogus' }, 'ExtractPlaceResponse');
    } catch (err) {
      expect(err).toBeInstanceOf(SchemaValidationError);
      expect((err as SchemaValidationError).label).toBe('ExtractPlaceResponse');
      expect((err as SchemaValidationError).issues.length).toBeGreaterThan(0);
    }
  });
});
