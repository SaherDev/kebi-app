import type { LocationContext } from '@kebi-app/shared';

/**
 * Client-side location enrichment via BigDataCloud's free reverse-geocode
 * endpoint.
 *
 * IMPORTANT — browser only. This endpoint must be called from the browser
 * with live GPS coordinates. Server-side calls return 402 and get the IP
 * banned. It is therefore deliberately a plain `fetch` here, NOT routed
 * through apps/web/src/api/transports/ (that layer is for Kebi backend
 * calls — auth, base URL, location injection; this is a third-party
 * client-side call outside our API contract).
 *
 * Endpoint and locality language are read from the environment (zero
 * hardcoding rule, standards.md):
 *   - NEXT_PUBLIC_REVERSE_GEOCODE_URL
 *   - NEXT_PUBLIC_REVERSE_GEOCODE_LANGUAGE
 *
 * Neighborhood rule (verified against real responses): when
 * `locality !== city`, `locality` IS the neighborhood; when they match,
 * no neighborhood data is available. Coverage is uneven by region —
 * frequently `null` in Israel and smaller cities.
 */

// Re-exported so call sites can import the contract type from one place.
export type { LocationContext } from '@kebi-app/shared';

/** Coordinates plus best-effort enrichment; the shape sent on every request. */
export type EnrichedLocation = {
  lat: number;
  lng: number;
  context: LocationContext | null;
};

/** A slow provider must never block the consult flow. */
const REVERSE_GEOCODE_TIMEOUT_MS = 3000;

/**
 * Reverse-geocode `lat`/`lng` to a {@link LocationContext}. Never throws:
 * any failure (missing config, non-200, network error, timeout, parse
 * error) is logged via `console.warn` and resolves to `context: null` so
 * enrichment stays best-effort and non-blocking.
 */
export async function enrichLocation(
  lat: number,
  lng: number,
): Promise<EnrichedLocation> {
  return { lat, lng, context: await reverseGeocode(lat, lng) };
}

async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<LocationContext | null> {
  const baseUrl = process.env.NEXT_PUBLIC_REVERSE_GEOCODE_URL;
  if (!baseUrl) {
    console.warn('[location] NEXT_PUBLIC_REVERSE_GEOCODE_URL is not set');
    return null;
  }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
  });
  const language = process.env.NEXT_PUBLIC_REVERSE_GEOCODE_LANGUAGE;
  if (language) params.set('localityLanguage', language);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REVERSE_GEOCODE_TIMEOUT_MS,
  );

  try {
    const res = await fetch(`${baseUrl}?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[location] reverse geocode failed: HTTP ${res.status}`);
      return null;
    }
    return toLocationContext(await res.json());
  } catch (err) {
    console.warn('[location] reverse geocode error', err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function toLocationContext(data: unknown): LocationContext {
  const record =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  const str = (value: unknown): string | null =>
    typeof value === 'string' && value.length > 0 ? value : null;

  const city = str(record.city);
  const locality = str(record.locality);

  return {
    city,
    // Verified rule: locality is the neighborhood only when it differs
    // from the city; when they match there is no neighborhood data.
    neighborhood: locality && locality !== city ? locality : null,
    district: str(record.principalSubdivision),
    countryCode: str(record.countryCode),
    countryName: str(record.countryName),
  };
}
