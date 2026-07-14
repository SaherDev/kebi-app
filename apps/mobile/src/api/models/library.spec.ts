import { validate } from '../validate';
import { SchemaValidationError } from '../validate';
import {
  LibraryResponse,
  LibraryResponseSchema,
  PlaceNote,
  SavedPlaceView,
  UserPlace,
} from './library';
import { PlaceCore } from './place-core';

const PLACE = {
  id: 'p1',
  provider_id: null,
  place_name: 'Saint Jardim',
  place_name_aliases: [],
  categories: ['restaurant'],
  tags: [],
  location: null,
  created_at: null,
  refreshed_at: null,
};

const USER_DATA = {
  user_place_id: 'u1',
  place_id: 'p1',
  approved: false,
  visited: false,
  liked: null,
  note: null,
  source: 'instagram',
  source_ref: 'https://www.instagram.com/tokyofoodreport/',
  source_label: 'Saint Jardim',
  saved_at: '2026-05-01T08:00:00Z',
  visited_at: null,
};

describe('LibraryResponseSchema', () => {
  it('parses a contract sample into nested class instances', () => {
    const res = validate(
      LibraryResponseSchema,
      { places: [{ place: PLACE, user_data: USER_DATA }], next_cursor: null, total: 42 },
      'LibraryResponse',
    );

    expect(res).toBeInstanceOf(LibraryResponse);
    expect(res.places[0]).toBeInstanceOf(SavedPlaceView);
    expect(res.places[0].place).toBeInstanceOf(PlaceCore);
    expect(res.places[0].user_data).toBeInstanceOf(UserPlace);
    expect(res.next_cursor).toBeNull();
    expect(res.total).toBe(42);
    // A place with no `claims` key (pre-ADR-127 or empty) → [].
    expect(res.places[0].claims).toEqual([]);
  });

  it('parses ADR-127 claims into PlaceNote instances', () => {
    const res = validate(
      LibraryResponseSchema,
      {
        places: [
          {
            place: PLACE,
            user_data: USER_DATA,
            claims: [
              { text: 'order the omakase', tags: ['food'], source: 'community', from_shared: true },
            ],
          },
        ],
        next_cursor: null,
        total: 1,
      },
      'LibraryResponse',
    );

    expect(res.places[0].claims[0]).toBeInstanceOf(PlaceNote);
    expect(res.places[0].claims[0].text).toBe('order the omakase');
    expect(res.places[0].claims[0].from_shared).toBe(true);
  });

  it('tolerates a missing total (pre-rollout) → null', () => {
    const res = validate(
      LibraryResponseSchema,
      { places: [], next_cursor: null },
      'LibraryResponse',
    );

    expect(res.total).toBeNull();
  });

  it('tolerates an unknown source value and strips unknown keys (forward-compat)', () => {
    const res = validate(
      LibraryResponseSchema,
      {
        places: [
          { place: PLACE, user_data: { ...USER_DATA, source: 'pinterest', extra_field: 1 } },
        ],
        next_cursor: null,
      },
      'LibraryResponse',
    );

    expect(res.places[0].user_data.source).toBe('pinterest');
    expect(res.places[0].user_data).not.toHaveProperty('extra_field');
  });

  it('rejects a malformed user_data row', () => {
    expect(() =>
      validate(
        LibraryResponseSchema,
        { places: [{ place: PLACE, user_data: { ...USER_DATA, visited: 'yes' } }], next_cursor: null },
        'LibraryResponse',
      ),
    ).toThrow(SchemaValidationError);
  });
});
