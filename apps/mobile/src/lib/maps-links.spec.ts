import type { PlaceCore, PlaceCoreLocation } from '@kebi-app/shared';
import {
  appleDirectionsUrl,
  buildMapsTargets,
  googleDirectionsUrl,
  wazeDirectionsUrl,
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

describe('googleDirectionsUrl', () => {
  it('routes by the google place id (durable, exact)', () => {
    const url = googleDirectionsUrl(place({ provider_id: 'google:ChIJ123' }));
    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Saint%20Jardim&destination_place_id=ChIJ123',
    );
  });

  it('works without coords (survives the location TTL wipe)', () => {
    expect(googleDirectionsUrl(place({ provider_id: 'google:ChIJ123', location: null }))).toContain(
      'destination_place_id=ChIJ123',
    );
  });

  it('is null for a non-google or missing provider id', () => {
    expect(googleDirectionsUrl(place({ provider_id: 'foursquare:abc' }))).toBeNull();
    expect(googleDirectionsUrl(place({ provider_id: null }))).toBeNull();
    expect(googleDirectionsUrl(place({ provider_id: 'google:' }))).toBeNull();
  });
});

describe('appleDirectionsUrl', () => {
  it('routes by coords', () => {
    expect(appleDirectionsUrl(place({ location: coords }))).toBe(
      'https://maps.apple.com/?daddr=35.66,139.66&q=Saint%20Jardim',
    );
  });

  it('is null without coords (cannot use a google id)', () => {
    expect(appleDirectionsUrl(place({ provider_id: 'google:ChIJ123', location: null }))).toBeNull();
  });
});

describe('wazeDirectionsUrl', () => {
  it('routes by coords', () => {
    expect(wazeDirectionsUrl(place({ location: coords }))).toBe(
      'https://waze.com/ul?ll=35.66,139.66&navigate=yes',
    );
  });

  it('is null without coords', () => {
    expect(wazeDirectionsUrl(place({ location: null }))).toBeNull();
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
