import type { HttpClient } from './types';
import { API_ROUTES } from './routes';
import { validate } from './validate';
import { ExtractPlaceResponse, ExtractPlaceResponseSchema } from './models/extract';

/**
 * `POST /v1/extract` — save a place (api-contract.md §POST /v1/extract, ADR-073).
 * The body is just `{ raw_input }`; kebi detects provenance server-side, so the
 * client never sends a `source`. Synchronous: a cold video URL can take ~30–60 s.
 *
 * The response is validated into an `ExtractPlaceResponse` class instance at this
 * boundary (ADR-046) — fail-closed via {@link validate} on schema drift. Domain
 * outcomes (`failed`/`unsupported_url`) ride a 200 in `status`/`failure_reason`;
 * the caller inspects them. Transport errors surface as `HttpError`.
 */

/**
 * Client-side ceiling for an extract call — above the gateway's ~60 s video path
 * so a genuinely hung request fails to an error toast instead of spinning forever.
 */
export const EXTRACT_TIMEOUT_MS = 90_000;

export async function extractPlace(
  client: HttpClient,
  rawInput: string,
  signal?: AbortSignal,
): Promise<ExtractPlaceResponse> {
  const raw = await client.post(API_ROUTES.extract, { raw_input: rawInput }, signal);
  return validate(ExtractPlaceResponseSchema, raw, 'ExtractPlaceResponse');
}
