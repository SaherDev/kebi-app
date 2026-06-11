import type { PlaceCore, SavedPlaceView } from "./types";
import type { PriceTag } from "./place-taxonomy";
import { CARD_FACETS, CATEGORY_GROUP } from "./card-facets";

/**
 * Pure presentation helpers for a saved place — shared so web and mobile render
 * the Library card identically. No i18n or UI imports: these return raw
 * values/keys, and the component formats (price → i18n, joins with `·`).
 */

/** snake_case tag/category value → spaced label ("hot_spring" → "hot spring"). */
export function humanize(value: string): string {
  return value.replace(/_/g, " ").trim();
}

/** The known price tags, for narrowing a free-text tag value. */
const PRICE_TAGS: ReadonlySet<string> = new Set<PriceTag>([
  "free",
  "budget",
  "moderate",
  "expensive",
  "very_expensive",
]);

/**
 * Card title: the name the user saw in the source post (`source_label`,
 * ADR-081), falling back to the canonical catalog name.
 */
export function placeDisplayName(view: SavedPlaceView): string {
  return view.user_data.source_label ?? view.place.place_name;
}

/** The place's price tag, if it carries one. */
export function findPriceTag(place: PlaceCore): PriceTag | null {
  const tag = place.tags.find((t) => t.type === "price");
  return tag && PRICE_TAGS.has(tag.value) ? (tag.value as PriceTag) : null;
}

/** First tag value of any of the given types, in priority order. */
function findFacet(place: PlaceCore, types: readonly string[]): string | null {
  for (const type of types) {
    const tag = place.tags.find((t) => t.type === type);
    if (tag) return tag.value;
  }
  return null;
}

/** First cuisine tag value, if any (Title-Case, e.g. "Japanese"). */
function findCuisine(place: PlaceCore): string | null {
  return place.tags.find((t) => t.type === "cuisine")?.value ?? null;
}

/**
 * A detail-line segment. `text` is display-ready (already humanized); `price`
 * is a {@link PriceTag} the component resolves via i18n (`$`/`$$`/…).
 */
export type DetailSegment =
  | { kind: "text"; value: string }
  | { kind: "price"; value: PriceTag };

/**
 * The card's detail line, composed per the place's category via
 * {@link CARD_FACETS}: `descriptor · facet · price · area`. Any slot with no
 * data is omitted (the component renders whatever is returned). The descriptor
 * is a cuisine tag for eat/drink groups (else the category label); the facet is
 * the first present tag from the group's priority list.
 */
export function buildDetailSegments(place: PlaceCore): DetailSegment[] {
  const segments: DetailSegment[] = [];
  const category = place.categories[0] ?? null;
  const group = category ? CATEGORY_GROUP[category] : null;
  const rule = group ? CARD_FACETS[group] : null;

  // descriptor
  const cuisine = rule?.descriptor === "cuisine" ? findCuisine(place) : null;
  const descriptor = cuisine ?? (category ? humanize(category) : null);
  if (descriptor) segments.push({ kind: "text", value: descriptor });

  // facet
  const facet = rule ? findFacet(place, rule.facet) : null;
  if (facet) segments.push({ kind: "text", value: humanize(facet) });

  // price
  const price = findPriceTag(place);
  if (price) segments.push({ kind: "price", value: price });

  // area
  const area = place.location?.neighborhood ?? place.location?.city ?? null;
  if (area) segments.push({ kind: "text", value: area });

  return segments;
}
