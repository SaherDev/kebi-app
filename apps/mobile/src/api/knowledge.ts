import type { CurateAnchor } from '@kebi-app/shared';
import type { HttpClient } from './types';
import { API_ROUTES } from './routes';
import { validate } from './validate';
import {
  CurateResult,
  CurateResultSchema,
  EntitySearchSchema,
  KnowledgeClaimsSchema,
  type EntityHit,
  type KnowledgeClaimsPage,
} from './models/knowledge';

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

/** Contract bound: the typeahead rejects a term shorter than this. */
export const ENTITY_SEARCH_MIN_LENGTH = 2;

/**
 * Typeahead behind the anchor chip — places and areas in one list, areas first.
 * Deterministic upstream (no LLM), so it is cheap enough to call per keystroke
 * once debounced. No matches is an empty list, never an error.
 */
export async function searchEntities(client: HttpClient, q: string): Promise<EntityHit[]> {
  const raw = await client.get(`${API_ROUTES.knowledgeEntities}?q=${encodeURIComponent(q)}`);
  return validate(EntitySearchSchema, raw, 'EntitySearch');
}

/**
 * One newest-first page of the caller's own claims — what backs "what you've
 * added". Ownership is resolved upstream from the verified user id; there is no
 * author filter to pass, and none to forget.
 */
export async function listClaims(
  client: HttpClient,
  cursor?: string,
): Promise<KnowledgeClaimsPage> {
  const path = cursor
    ? `${API_ROUTES.knowledgeClaims}?cursor=${encodeURIComponent(cursor)}`
    : API_ROUTES.knowledgeClaims;
  const raw = await client.get(path);
  return validate(KnowledgeClaimsSchema, raw, 'KnowledgeClaims');
}

/**
 * Retract one of the caller's own claims. Author-only upstream: a claim that is
 * not yours 404s exactly like one that does not exist, so ids cannot be probed.
 * Resolves to nothing — a 204 carries no body.
 */
export async function retractClaim(client: HttpClient, id: string): Promise<void> {
  await client.delete(API_ROUTES.knowledgeClaim(id));
}
