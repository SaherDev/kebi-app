import type { AreaHandle, LibraryAreaCount } from '@kebi-app/shared';
import { LIBRARY_MIN_GROUP_SIZE } from './library-config';

/**
 * Turning kebi's area distribution into the Library's section list (ADR-165).
 *
 * kebi returns **exact-key** counts — `id/bali/canggu` and `id/bali` are
 * separate entries and nested ones are never folded in. That asymmetry is
 * deliberate (pre-summing would make the leaf histogram unavailable), so the
 * rollup below is the client's job.
 *
 * Geo keys are slash-hierarchical, so folding a group into its parent is one
 * segment off the end. That `/`-nesting is the **only** structure the contract
 * lets a client rely on: since ADR-169 the segments themselves are geo-registry
 * provider ids, never names, so nothing here parses or displays one. The
 * country comes off the handle's `country_code`, and the heading off its
 * `name`.
 */

/** One section on the Library screen. */
export interface LibraryGroup {
  /** The geo key this group's rows are fetched with (`?area=`, prefix match). */
  key: string;
  name: string;
  icon: string | null;
  /** The area screen this header opens. */
  uri: string;
  /** Exact count across the whole library, folded where the rule applies. */
  count: number;
  /** Every distribution key that folded into this group — the row lookup. */
  memberKeys: string[];
  /** ISO alpha-2 of this group's country, for home-first ordering. */
  countryCode: string | null;
}

/**
 * The country an area sits in.
 *
 * kebi ships it as `country_code` so a client never reads the opaque key. The
 * fallback is the key's head, which is the ISO code in both the slug and the
 * id-path era — **rollout only**, for a build talking to a kebi from before the
 * ADR-169 deploy. Delete it once that is live.
 */
function countryCodeOf(key: string, handle: AreaHandle | undefined): string | null {
  return handle?.country_code ?? key.split('/')[0] ?? null;
}

/** One level up, or `null` at country level. */
function parentKeyOf(key: string): string | null {
  const cut = key.lastIndexOf('/');
  return cut === -1 ? null : key.slice(0, cut);
}

/**
 * Resolves an ISO country code to a name. Supplied by the caller — the app
 * backs it with the i18n bundle, and a test can hand in anything.
 */
export type CountryNames = (code: string) => string | null;

/**
 * What a group's heading reads.
 *
 * kebi names every area it has a row for, and that name always wins — except
 * at country level, which this index ships no handle for (kebi's call: a
 * country is not an area anyone navigates to from here), so the code is looked
 * up locally. Failing that the code stands, uppercased, so it reads as a
 * deliberate country code rather than a broken string.
 *
 * **The key is never a heading.** Its segments are provider ids since ADR-169
 * — `id/ChIJoQ8Q…` on screen is worse than useless — so an unnamed group falls
 * back to its country, which is always known.
 *
 * The lookup is injected rather than `Intl.DisplayNames`, which **Hermes does
 * not implement** — relying on it meant a silent fall back to the bare code on
 * device while passing every test under Node.
 */
function displayName(
  key: string,
  handle: AreaHandle | undefined,
  countryCode: string | null,
  countryNames: CountryNames,
): string {
  const country = countryCode ? countryNames(countryCode) : null;
  const bareCode = (countryCode ?? '').toUpperCase();
  // Country level: nothing upstream names countries, so the lookup is the name.
  if (!key.includes('/')) return country ?? bareCode;
  // Deeper: kebi named it, unless this is a fold target the distribution never
  // described — then the country stands in for a key we must not print.
  return handle?.name ?? country ?? bareCode;
}

/**
 * Build the section list from the area distribution.
 *
 * **The rollup rule: an area needs {@link LIBRARY_MIN_GROUP_SIZE} saves to earn
 * its own heading.** Anything thinner folds into its parent, repeatedly, until
 * it is big enough or it reaches the country. Countries always stand.
 *
 * kebi keys as deep as it can, which fragments a library badly: 37 real saves
 * produced fifteen headings, most of them `1` — `Bang Pu Mai 1`, `Sam Phran 1`,
 * `Dong Lakhon 1`. Those are eight separate tiny municipalities around Bangkok,
 * not neighbourhoods of one city, so folding has to continue past the city or
 * nothing merges. Folded, they become one Thailand group, while `Canggu` and
 * `Uluwatu` keep their own names — they are big enough to deserve them.
 *
 * A folded group keys on the ancestor and `?area=` matches by prefix, so it
 * still fetches every row beneath it.
 *
 * `memberKeys` records which distribution keys landed in each group, so a row
 * can be filed under the same heading its count was.
 */
export function buildLibraryGroups(
  areas: LibraryAreaCount[],
  homeCountry?: string | null,
  countryNames: CountryNames = () => null,
): LibraryGroup[] {
  // Every handle we've seen, by key — an entry's own, and its parent's. A fold
  // target is usually named by one of these rather than needing invention.
  const handles = new Map<string, AreaHandle>();
  for (const { area } of areas) {
    handles.set(area.key, area);
    if (area.parent && !handles.has(area.parent.key)) {
      handles.set(area.parent.key, { ...area.parent, parent: null });
    }
  }

  // The country rides along on the bucket rather than being re-derived at the
  // end: a fold target the distribution never described has no handle of its
  // own, but its members do, and an ancestor is always in the same country.
  let buckets = areas.map(({ area, count }) => ({
    key: area.key,
    count,
    memberKeys: [area.key],
    countryCode: countryCodeOf(area.key, area),
  }));

  // Fold upward until every group is big enough or has run out of ancestors,
  // **one depth at a time, deepest first**. Order matters: a neighbourhood has
  // to land in its city before the city decides whether it is big enough to
  // stand, or a thin city folds to its country and takes its children with it.
  const depthOf = (key: string) => key.split('/').length;
  for (;;) {
    const foldable = buckets.filter(
      (bucket) => bucket.count < LIBRARY_MIN_GROUP_SIZE && parentKeyOf(bucket.key) !== null,
    );
    if (foldable.length === 0) break;
    const deepest = Math.max(...foldable.map((bucket) => depthOf(bucket.key)));

    const merged = new Map<
      string,
      { key: string; count: number; memberKeys: string[]; countryCode: string | null }
    >();
    for (const bucket of buckets) {
      const parent = parentKeyOf(bucket.key);
      const target =
        bucket.count < LIBRARY_MIN_GROUP_SIZE && parent && depthOf(bucket.key) === deepest
          ? parent
          : bucket.key;

      const existing = merged.get(target);
      if (existing) {
        existing.count += bucket.count;
        existing.memberKeys.push(...bucket.memberKeys);
        existing.countryCode ??= bucket.countryCode;
      } else {
        merged.set(target, {
          key: target,
          count: bucket.count,
          memberKeys: [...bucket.memberKeys],
          countryCode: bucket.countryCode,
        });
      }
    }
    buckets = [...merged.values()];
  }

  const groups = buckets.map((bucket) => {
    const handle = handles.get(bucket.key);
    const countryCode = handle?.country_code ?? bucket.countryCode;
    return {
      key: bucket.key,
      name: displayName(bucket.key, handle, countryCode, countryNames),
      icon: handle?.icon ?? null,
      uri: handle?.uri ?? '',
      count: bucket.count,
      memberKeys: bucket.memberKeys,
      countryCode,
    };
  });

  return orderLibraryGroups(groups, homeCountry);
}

/**
 * Order groups for display: `homeCountry` first, largest within each side, name
 * as a stable tie-break. Split out from {@link buildLibraryGroups} because the
 * device's country resolves *after* the first paint — the list re-orders when
 * it arrives without refetching anything.
 *
 * Size alone reads wrong on the road: in Bali with saves in Canggu (5), Da Nang
 * (4) and Uluwatu (3), biggest-first splits the two Bali areas apart with a
 * Vietnamese city nobody standing in Canggu wants between them. Matching is on
 * `country_code`, never on a name and never on the key.
 *
 * Returns a new array; the input is not mutated.
 */
export function orderLibraryGroups(
  groups: LibraryGroup[],
  homeCountry?: string | null,
): LibraryGroup[] {
  const home = homeCountry?.toLowerCase() ?? null;
  const isHome = (group: LibraryGroup) =>
    home !== null && group.countryCode?.toLowerCase() === home ? 0 : 1;

  return [...groups].sort(
    (a, b) => isHome(a) - isHome(b) || b.count - a.count || a.name.localeCompare(b.name),
  );
}

/**
 * Which group each distribution key belongs to, so a loaded row can be filed
 * under the same heading its count was counted into.
 */
export function groupKeyByAreaKey(groups: LibraryGroup[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const group of groups) {
    for (const member of group.memberKeys) lookup.set(member, group.key);
  }
  return lookup;
}

/**
 * How many saves have no area at all — geography coarser than a city, so kebi
 * omits them from the distribution entirely.
 *
 * kebi counts them as `unassigned_count`, which is the whole point: derived
 * client-side it is `total` minus the sum, a number that is only right once the
 * entire library is paged in and understates itself until then.
 *
 * The derivation survives as the rollout fallback for a kebi from before that
 * field shipped — delete it, and the `served` parameter's null branch, once the
 * deploy is live. `0` when the total is unknown too, so an unpopulated `total`
 * shows no bucket rather than a wrong one.
 */
export function elsewhereCount(
  served: number | null | undefined,
  areas: LibraryAreaCount[],
  total: number | null,
): number {
  // Undefined as well as null: a kebi that omits the field entirely is not
  // claiming zero, and arithmetic on `undefined` would put NaN on screen.
  if (served !== null && served !== undefined) return Math.max(0, served);
  if (total === null) return 0;
  const keyed = areas.reduce((sum, entry) => sum + entry.count, 0);
  return Math.max(0, total - keyed);
}
