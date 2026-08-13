import type { PlaceCore } from '@kebi-app/shared';

/**
 * Builds external "show this place on the map" deep links for the maps chooser
 * (kebi-place-maps-chooser-options.html, design A). They open the place itself —
 * a pin / place card, never turn-by-turn directions (the user navigates from
 * there if they want to). These are plain URL schemes handed to
 * `Linking.openURL` — NOT Google Places API calls (no key, no fetch), so they
 * stay within the gateway's "no Google API in kebi-app" rule.
 *
 * Google is the durable target: it routes by the place's `provider_id`
 * (`google:ChIJ…`), which is identity and survives the 30-day location-TTL wipe.
 * Apple and Waze can't use a Google place id, so they fall back to `location`
 * coords and are unavailable once those are wiped. Each provider returns `null`
 * when its inputs are absent; `buildMapsTargets` lists only the available ones.
 */

export type MapsApp = 'google' | 'apple' | 'waze';

export interface MapsTarget {
  app: MapsApp;
  url: string;
}

/**
 * Strategy for one external maps app. To add an app: extend {@link MapsApp},
 * add a class here, append its instance to {@link MAPS_PROVIDERS}, and add its
 * `place.maps.<app>` label — the chooser picks it up from the registry.
 */
export interface MapsProvider {
  readonly app: MapsApp;
  /** "Show this place" URL, or `null` when the place lacks what this app needs. */
  buildUrl(place: PlaceCore): string | null;
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
 * Google Maps "view place" URL via the place id (exact place, durable). Uses the
 * official Maps URLs search scheme; `query` carries the name for display while
 * `query_place_id` pins the exact place card. Also reused for sharing.
 */
export class GoogleMapsProvider implements MapsProvider {
  readonly app = 'google' as const;

  buildUrl(place: PlaceCore): string | null {
    const placeId = googlePlaceId(place);
    if (!placeId) return null;
    const name = encodeURIComponent(place.place_name);
    return `https://www.google.com/maps/search/?api=1&query=${name}&query_place_id=${placeId}`;
  }
}

/** Apple Maps "show pin" URL — name searched at the coords (no Google-id support). */
export class AppleMapsProvider implements MapsProvider {
  readonly app = 'apple' as const;

  buildUrl(place: PlaceCore): string | null {
    const c = coords(place);
    if (!c) return null;
    const name = encodeURIComponent(place.place_name);
    return `https://maps.apple.com/?ll=${c.lat},${c.lng}&q=${name}`;
  }
}

/** Waze "show on map" URL via coords (no `navigate=yes` — preview, not routing). */
export class WazeMapsProvider implements MapsProvider {
  readonly app = 'waze' as const;

  buildUrl(place: PlaceCore): string | null {
    const c = coords(place);
    if (!c) return null;
    return `https://waze.com/ul?ll=${c.lat},${c.lng}`;
  }
}

/** Shared singleton — also used directly where only the durable Google link makes sense (sharing). */
export const googleMaps = new GoogleMapsProvider();

/** Every supported maps app, in display order (Google first — the durable, exact one). */
export const MAPS_PROVIDERS: MapsProvider[] = [
  googleMaps,
  new AppleMapsProvider(),
  new WazeMapsProvider(),
];

/**
 * The available maps targets for a place, in provider order. Apps whose URL
 * can't be built are omitted, so the chooser only ever shows working rows.
 * Empty when nothing can be built.
 */
export function buildMapsTargets(place: PlaceCore): MapsTarget[] {
  const targets: MapsTarget[] = [];
  for (const provider of MAPS_PROVIDERS) {
    const url = provider.buildUrl(place);
    if (url) targets.push({ app: provider.app, url });
  }
  return targets;
}
