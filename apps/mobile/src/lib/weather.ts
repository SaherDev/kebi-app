/**
 * Current weather for the home header (Open-Meteo — free, no API key, no signup).
 * Display-only chrome plus a coarse hint passed to GET /v1/home; it is NOT part
 * of the AI pipeline, so a client-side fetch is fine (same precedent as the
 * client-side reverse-geocode). Best-effort and time-boxed: any failure resolves
 * to `null`, mirroring `getDeviceLocation` — the header just shows less, never
 * blocks or errors.
 */

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const FETCH_TIMEOUT_MS = 3000;

export interface Weather {
  /** Rounded degrees Celsius. */
  tempC: number;
  /** Coarse lowercase condition — also the `weather` hint sent to /v1/home. */
  condition: string;
}

export async function getWeather(lat: number, lng: number): Promise<Weather | null> {
  try {
    const url = `${FORECAST_URL}?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`;
    const res = await withTimeout(fetch(url), FETCH_TIMEOUT_MS);
    if (!res || !res.ok) return null;
    const json = await res.json();
    const temp = json?.current?.temperature_2m;
    const code = json?.current?.weather_code;
    if (typeof temp !== 'number' || typeof code !== 'number') return null;
    return { tempC: Math.round(temp), condition: conditionForCode(code) };
  } catch {
    return null;
  }
}

/** Fold a WMO weather code into a coarse, lowercase band (open-meteo.com/en/docs). */
function conditionForCode(code: number): string {
  if (code === 0) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code <= 48) return 'fog';
  if (code <= 67) return 'rain';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'rain';
  if (code <= 86) return 'snow';
  return 'storm';
}

/** Resolve `promise`, or `null` if it hasn't settled within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}
