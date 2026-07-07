import type { HttpClient } from './types';
import { API_ROUTES } from './routes';
import { validate } from './validate';
import { HomeResponse, HomeResponseSchema } from './models/home';

/**
 * The home opening surface (api-contract.md §GET /v1/home, ADR-111). Thin
 * function over the injected {@link HttpClient}; the response is validated at
 * this boundary into a class instance (ADR-046). Identity is the gateway's
 * verified header — never a body/query field. The client supplies the local
 * context (location, time, weather) the server can't know.
 */

/** Client-supplied context for the greeting + chips. All optional. */
export interface HomeQuery {
  lat?: number;
  lng?: number;
  city?: string;
  local_time?: string;
  weather?: string;
}

/** Build the `?…` query string, omitting unset params. */
export function homeQueryString(query: HomeQuery): string {
  const params = new URLSearchParams();
  if (query.lat !== undefined) params.set('lat', String(query.lat));
  if (query.lng !== undefined) params.set('lng', String(query.lng));
  if (query.city) params.set('city', query.city);
  if (query.local_time) params.set('local_time', query.local_time);
  if (query.weather) params.set('weather', query.weather);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** GET the greeting + suggestion chips for the caller's current context. */
export async function getHome(
  client: HttpClient,
  query: HomeQuery = {},
): Promise<HomeResponse> {
  const raw = await client.get(`${API_ROUTES.home}${homeQueryString(query)}`);
  return validate(HomeResponseSchema, raw, 'HomeResponse');
}
