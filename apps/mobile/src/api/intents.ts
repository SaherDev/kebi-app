import type { HttpClient } from './types';
import { API_ROUTES } from './routes';
import { validate } from './validate';
import { IntentsResponse, IntentsResponseSchema } from './models/intents';

/**
 * The "what you wanted" recall read (api-contract.md §GET /v1/user/intents,
 * ADR-110). Thin function over the injected {@link HttpClient}; the response is
 * validated at this boundary into a class instance (ADR-046). Identity is the
 * gateway's verified header — a caller only ever reads their own intents.
 */

/** Query params for a recall page. Keyset cursor; newest-first. */
export interface IntentsQuery {
  limit?: number;
  cursor?: string;
}

/** Build the `?…` query string, omitting unset params. */
export function intentsQueryString(query: IntentsQuery): string {
  const params = new URLSearchParams();
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.cursor) params.set('cursor', query.cursor);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** GET a page of the caller's recalled intents. */
export async function getIntents(
  client: HttpClient,
  query: IntentsQuery = {},
): Promise<IntentsResponse> {
  const raw = await client.get(`${API_ROUTES.userIntents}${intentsQueryString(query)}`);
  return validate(IntentsResponseSchema, raw, 'IntentsResponse');
}
