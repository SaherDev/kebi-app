/**
 * The one place that reads a `kebi://area/{id}` URI.
 *
 * kebi's area ids are opaque tokens, not the geo key: the key is a slash path
 * (`id/bali/canggu`) and would read as URL structure, so it travels encoded and
 * only kebi's codec knows the format (ADR-153). The entity's `key` field still
 * carries the raw path — for display and matching, never for a request.
 *
 * So the client needs exactly one operation on an area URI: take the last
 * segment and hand it to `GET /v1/areas/{id}`. That is a lift, not a parse — we
 * never decode it, split it further, or validate its shape. A token this build
 * doesn't recognise is kebi's 404 to answer, not ours to pre-empt.
 *
 * Applies to every area URI on the wire — a chat entity, a breadcrumb crumb,
 * and a child-area row all carry the same pre-composed form.
 */

const AREA_URI_PREFIX = 'kebi://area/';

/**
 * The request id behind an area URI, or `null` when the URI isn't one (a venue
 * link, or a token-less `kebi://area/`). A caller that gets `null` has nothing
 * to fetch and should not navigate.
 */
export function areaIdFromUri(uri: string): string | null {
  if (!uri.startsWith(AREA_URI_PREFIX)) return null;
  const id = uri.slice(AREA_URI_PREFIX.length);
  return id.length > 0 ? id : null;
}
