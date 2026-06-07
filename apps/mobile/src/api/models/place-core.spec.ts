import {
  PlaceCore,
  PlaceCoreLocation,
  PlaceCoreSchema,
  PlaceNameAlias,
  PlaceTag,
} from './place-core';

// The canonical PlaceCore example from docs/api-contract.md → Shared Types.
const PLACE_CORE_FIXTURE = {
  id: 'c0ffee00-1111-2222-3333-444455556666',
  provider_id: 'google:ChIJN1t_tDeuEmsRUsoyG83frY4',
  place_name: 'Nara Eatery',
  place_name_aliases: [{ value: 'Nara', source: 'tiktok' }],
  categories: ['restaurant'],
  tags: [
    { type: 'cuisine', value: 'Japanese', source: 'google' },
    { type: 'atmosphere', value: 'casual', source: 'llm' },
  ],
  location: {
    lat: 13.778,
    lng: 100.541,
    address: '123 Ari Soi 4, Bangkok 10400',
    neighborhood: 'Ari',
    city: 'Bangkok',
    country: 'TH',
  },
  created_at: '2026-04-12T10:15:00Z',
  refreshed_at: '2026-05-01T08:00:00Z',
};

describe('PlaceCoreSchema', () => {
  it('parses the contract example into a PlaceCore with class-instance leaves', () => {
    const place = PlaceCoreSchema.parse(PLACE_CORE_FIXTURE);

    expect(place).toBeInstanceOf(PlaceCore);
    expect(place.place_name).toBe('Nara Eatery');
    expect(place.place_name_aliases[0]).toBeInstanceOf(PlaceNameAlias);
    expect(place.tags[0]).toBeInstanceOf(PlaceTag);
    expect(place.location).toBeInstanceOf(PlaceCoreLocation);
    expect(place.location?.city).toBe('Bangkok');
  });

  it('accepts null id and null location (freshly-built / location-less places)', () => {
    const place = PlaceCoreSchema.parse({
      ...PLACE_CORE_FIXTURE,
      id: null,
      location: null,
    });

    expect(place.id).toBeNull();
    expect(place.location).toBeNull();
  });

  it('accepts a category outside the known vocabulary (forward-compat)', () => {
    const place = PlaceCoreSchema.parse({
      ...PLACE_CORE_FIXTURE,
      categories: ['some_future_category'],
    });

    expect(place.categories).toEqual(['some_future_category']);
  });

  it('rejects a payload missing the required place_name', () => {
    const { place_name, ...withoutName } = PLACE_CORE_FIXTURE;
    expect(() => PlaceCoreSchema.parse(withoutName)).toThrow();
  });
});
