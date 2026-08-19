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
 * Geo keys are `{cc}/{city}[/{neighborhood}]`, so folding a group into its
 * parent is one segment off the end.
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
}

/** The `{cc}` head of a geo key — the country the area sits in. */
function countryOf(key: string): string {
  return key.split('/')[0];
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
 * at country level, where it hands back the ISO code itself (`th`) because
 * nothing upstream names countries. A code is not a heading, so it is looked
 * up; failing that the code stands, uppercased, so it reads as a deliberate
 * country code rather than a broken string.
 *
 * The lookup is injected rather than `Intl.DisplayNames`, which **Hermes does
 * not implement** — relying on it meant a silent fall back to the bare code on
 * device while passing every test under Node.
 */
function displayName(
  key: string,
  handle: AreaHandle | undefined,
  countryNames: CountryNames,
): string {
  // Country level only: everything deeper is named by kebi.
  const resolved = key.includes('/') ? null : countryNames(key);
  if (resolved) return resolved;
  // A "name" that is merely the key is no better than the key.
  if (handle && handle.name.toLowerCase() !== key.toLowerCase()) return handle.name;
  return key.includes('/') ? key : key.toUpperCase();
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

  let buckets = areas.map(({ area, count }) => ({
    key: area.key,
    count,
    memberKeys: [area.key],
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

    const merged = new Map<string, { key: string; count: number; memberKeys: string[] }>();
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
      } else {
        merged.set(target, { key: target, count: bucket.count, memberKeys: [...bucket.memberKeys] });
      }
    }
    buckets = [...merged.values()];
  }

  const groups = buckets.map((bucket) => {
    const handle = handles.get(bucket.key);
    return {
      key: bucket.key,
      name: displayName(bucket.key, handle, countryNames),
      icon: handle?.icon ?? null,
      uri: handle?.uri ?? '',
      count: bucket.count,
      memberKeys: bucket.memberKeys,
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
 * the key's `{cc}` head, never on a name.
 *
 * Returns a new array; the input is not mutated.
 */
export function orderLibraryGroups(
  groups: LibraryGroup[],
  homeCountry?: string | null,
): LibraryGroup[] {
  const home = homeCountry?.toLowerCase() ?? null;
  const isHome = (group: LibraryGroup) => (home !== null && countryOf(group.key) === home ? 0 : 1);

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
 * omits them from the distribution entirely. Derived rather than sent: it is
 * the grand total minus everything that *did* key.
 *
 * `0` when the total is unknown, so an unpopulated `total` shows no bucket
 * rather than a wrong one. Note this reads high on production until the
 * ADR-163 backfill runs — older rows have no country code, and a key cannot be
 * computed from one that isn't there.
 */
export function elsewhereCount(areas: LibraryAreaCount[], total: number | null): number {
  if (total === null) return 0;
  const keyed = areas.reduce((sum, entry) => sum + entry.count, 0);
  return Math.max(0, total - keyed);
}
