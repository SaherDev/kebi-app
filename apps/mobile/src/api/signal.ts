import type { SignalRequest } from '@kebi-app/shared';
import type { HttpClient } from './types';
import { API_ROUTES } from './routes';

/**
 * `POST /v1/signal` — a recommendation accept/reject signal (api-contract.md
 * §POST /v1/signal, ADR-076/078). Thin function over the injected
 * {@link HttpClient}, mirroring ./extract. Identity is the gateway's verified
 * header — never a body field; the body is exactly `{ signal_type,
 * recommendation_id, place_core_id }`.
 *
 * The endpoint returns `202 { status }`; the client doesn't use the body, so
 * this resolves `void`. Transport errors surface as `HttpError` for the caller
 * to categorise (e.g. a 429 plan rate-limit).
 */
export async function sendSignal(
  client: HttpClient,
  body: SignalRequest,
  signal?: AbortSignal,
): Promise<void> {
  await client.post(API_ROUTES.signal, body, signal);
}
