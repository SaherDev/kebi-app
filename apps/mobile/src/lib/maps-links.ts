import type { PlaceCore } from '@kebi-app/shared';

/**
 * Builds external "directions to this place" deep links for the maps chooser
 * (kebi-place-maps-chooser-options.html, design A). These are plain URL schemes
 * handed to `Linking.openURL` — NOT Google Places API calls (no key, no fetch),
 * so they stay within the gateway's "no Google API in kebi-app" rule.
 *
 * Google is the durable target: it routes by the place's `provider_id`
 * (`google:ChIJ…`), which is identity and survives the 30-day location-TTL wipe.
 * Apple and Waze can't use a Google place id, so they fall back to `location`
 * coords and are unavailable once those are wiped. Each builder returns `null`
 * when its inputs are absent; `buildMapsTargets` lists only the available ones.
 */

export type MapsApp = 'google' | 'apple' | 'waze';

export interface MapsTarget {
  app: MapsApp;
  url: string;
}

/** The Google place id behind a namespaced `provider_id`, or `null`. */
function googlePlaceId(place: PlaceCore): string | null {
  const id = place.provider_id;
  if (!id) return null;
  const [provider, ...rest] = id.split(':');
  if (provider !== 'google' || rest.length === 0) return null;
  const placeId = rest.join(':');
  return placeId.length > 0 ? placeId : null;
}

/** `{ lat, lng }` when both coords are present, else `null`. */
function coords(place: PlaceCore): { lat: number; lng: number } | null {
  const loc = place.location;
  if (!loc || loc.lat == null || loc.lng == null) return null;
  return { lat: loc.lat, lng: loc.lng };
}

/**
 * Google Maps directions URL via the place id (exact place, durable). Uses the
 * official Maps URLs scheme; `destination` carries the name for display while
 * `destination_place_id` pins the exact place.
 */
export function googleDirectionsUrl(place: PlaceCore): string | null {
  const placeId = googlePlaceId(place);
  if (!placeId) return null;
  const name = encodeURIComponent(place.place_name);
  return `https://www.google.com/maps/dir/?api=1&destination=${name}&destination_place_id=${placeId}`;
}

/**
 * Google Maps "view place" URL via the place id — for sharing (points at the
 * place card, not directions). Durable like {@link googleDirectionsUrl}.
 */
export function googlePlaceUrl(place: PlaceCore): string | null {
  const placeId = googlePlaceId(place);
  if (!placeId) return null;
  const name = encodeURIComponent(place.place_name);
  return `https://www.google.com/maps/search/?api=1&query=${name}&query_place_id=${placeId}`;
}

/** Apple Maps directions URL via coords (no Google-id support). */
export function appleDirectionsUrl(place: PlaceCore): string | null {
  const c = coords(place);
  if (!c) return null;
  const name = encodeURIComponent(place.place_name);
  return `https://maps.apple.com/?daddr=${c.lat},${c.lng}&q=${name}`;
}

/** Waze navigation URL via coords. */
export function wazeDirectionsUrl(place: PlaceCore): string | null {
  const c = coords(place);
  if (!c) return null;
  return `https://waze.com/ul?ll=${c.lat},${c.lng}&navigate=yes`;
}

/**
 * The available directions targets for a place, in display order (Google first —
 * the durable, exact one). Apps whose URL can't be built are omitted, so the
 * chooser only ever shows working rows. Empty when nothing can be built.
 */
export function buildMapsTargets(place: PlaceCore): MapsTarget[] {
  const builders: Array<[MapsApp, (p: PlaceCore) => string | null]> = [
    ['google', googleDirectionsUrl],
    ['apple', appleDirectionsUrl],
    ['waze', wazeDirectionsUrl],
  ];
  const targets: MapsTarget[] = [];
  for (const [app, build] of builders) {
    const url = build(place);
    if (url) targets.push({ app, url });
  }
  return targets;
}
