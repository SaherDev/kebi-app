import type { PlaceCore, PlaceCoreLocation } from '@kebi-app/shared';
import {
  AppleMapsProvider,
  buildMapsTargets,
  GoogleMapsProvider,
  WazeMapsProvider,
} from './maps-links';

function place(partial: Partial<PlaceCore>): PlaceCore {
  return {
    id: 'p1',
    provider_id: null,
    place_name: 'Saint Jardim',
    place_name_aliases: [],
    categories: [],
    tags: [],
    icon: null,
    location: null,
    created_at: null,
    refreshed_at: null,
    ...partial,
  };
}

const coords: PlaceCoreLocation = {
  lat: 35.66,
  lng: 139.66,
  address: null,
  neighborhood: 'Shimokitazawa',
  city: 'Tokyo',
  country: 'JP',
};

describe('GoogleMapsProvider', () => {
  const google = new GoogleMapsProvider();

  it('opens the place card by the google place id (durable, exact)', () => {
    const url = google.buildUrl(place({ provider_id: 'google:ChIJ123' }));
    expect(url).toBe(
      'https://www.google.com/maps/search/?api=1&query=Saint%20Jardim&query_place_id=ChIJ123',
    );
  });

  it('works without coords (survives the location TTL wipe)', () => {
    expect(google.buildUrl(place({ provider_id: 'google:ChIJ123', location: null }))).toContain(
      'query_place_id=ChIJ123',
    );
  });

  it('is null for a non-google or missing provider id', () => {
    expect(google.buildUrl(place({ provider_id: 'foursquare:abc' }))).toBeNull();
    expect(google.buildUrl(place({ provider_id: null }))).toBeNull();
    expect(google.buildUrl(place({ provider_id: 'google:' }))).toBeNull();
  });
});

describe('AppleMapsProvider', () => {
  const apple = new AppleMapsProvider();

  it('shows the named pin at the coords', () => {
    expect(apple.buildUrl(place({ location: coords }))).toBe(
      'https://maps.apple.com/?ll=35.66,139.66&q=Saint%20Jardim',
    );
  });

  it('is null without coords (cannot use a google id)', () => {
    expect(apple.buildUrl(place({ provider_id: 'google:ChIJ123', location: null }))).toBeNull();
  });
});

describe('WazeMapsProvider', () => {
  const waze = new WazeMapsProvider();

  it('shows the map at the coords without starting navigation', () => {
    expect(waze.buildUrl(place({ location: coords }))).toBe('https://waze.com/ul?ll=35.66,139.66');
  });

  it('is null without coords', () => {
    expect(waze.buildUrl(place({ location: null }))).toBeNull();
  });
});

describe('buildMapsTargets', () => {
  it('lists every available target, google first', () => {
    const targets = buildMapsTargets(place({ provider_id: 'google:ChIJ123', location: coords }));
    expect(targets.map((t) => t.app)).toEqual(['google', 'apple', 'waze']);
  });

  it('keeps google when coords are wiped', () => {
    const targets = buildMapsTargets(place({ provider_id: 'google:ChIJ123', location: null }));
    expect(targets.map((t) => t.app)).toEqual(['google']);
  });

  it('keeps apple/waze when there is no google id but coords exist', () => {
    const targets = buildMapsTargets(place({ provider_id: null, location: coords }));
    expect(targets.map((t) => t.app)).toEqual(['apple', 'waze']);
  });

  it('is empty when nothing can be built', () => {
    expect(buildMapsTargets(place({ provider_id: null, location: null }))).toEqual([]);
  });
});
