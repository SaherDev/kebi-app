import type { CurateAnchor } from '@kebi-app/shared';
import type { HttpClient } from './types';
import { API_ROUTES } from './routes';
import { validate } from './validate';
import { CurateResult, CurateResultSchema } from './models/knowledge';

/**
 * Insider curation calls (gateway `/knowledge/*`, ADR-121). Thin functions over
 * the injected {@link HttpClient}; responses are validated at this boundary into
 * class instances (ADR-046).
 *
 * Every route is gated on the curator role server-side, so a non-insider gets a
 * 403 here. That is deliberate defence in depth, not the primary UX: affordances
 * are hidden by `useCan('curate')` so these are only reached by someone who
 * should reach them.
 */

/**
 * Push prose for kebi to structure into claims. The response is **synchronous** —
 * the stored claims come back with it, so the caller can name the count without
 * polling.
 *
 * `anchor` pins the prose to one entity and is what makes `place`-scoped claims
 * expressible: unanchored prose stays geo-scoped, so a note written about a venue
 * would land on its city instead. Omitted entirely when absent, since the
 * contract wants exactly one of `place_id`/`area_id` or no anchor at all.
 */
export async function curate(
  client: HttpClient,
  text: string,
  anchor?: CurateAnchor,
): Promise<CurateResult> {
  const raw = await client.post(API_ROUTES.knowledgeCurate, anchor ? { text, anchor } : { text });
  return validate(CurateResultSchema, raw, 'CurateResult');
}
