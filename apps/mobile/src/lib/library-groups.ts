import type { AreaHandle, LibraryAreaCount } from '@kebi-app/shared';

/**
 * Turning kebi's area distribution into the Library's section list (ADR-165).
 *
 * kebi returns **exact-key** counts — `id/bali/canggu` and `id/bali` are
 * separate entries and nested ones are never folded in. That asymmetry is
 * deliberate (pre-summing would make the leaf histogram unavailable), so the
 * rollup below is the client's job.
 *
 * Geo keys are `{cc}/{city}[/{neighborhood}]`. An entry is therefore
 * city-level (2 segments) or neighbourhood-level (3). Anything coarser has no
 * handle at all and is absent from the distribution — that shortfall is the
 * "elsewhere" bucket, see {@link elsewhereCount}.
 */

/** Segments in a city-level geo key (`id/bali`). */
const CITY_KEY_SEGMENTS = 2;

/** One section on the Library screen. */
export interface LibraryGroup {
  /** The geo key this group's rows are fetched with (`?area=`, prefix match). */
  key: string;
  name: string;
  icon: string | null;
  /** The area screen this header opens. */
  uri: string;
  /** Exact count across the whole library, rolled up where the rule applies. */
  count: number;
}

/** The `{cc}/{city}` prefix of any key — the key itself when already that coarse. */
function cityKeyOf(key: string): string {
  const segments = key.split('/');
  return segments.length > CITY_KEY_SEGMENTS
    ? segments.slice(0, CITY_KEY_SEGMENTS).join('/')
    : key;
}

function toGroup(area: AreaHandle, count: number): LibraryGroup {
  return { key: area.key, name: area.name, icon: area.icon, uri: area.uri, count };
}

/**
 * Build the ordered section list from the area distribution.
 *
 * **The rollup rule:** group by the most-specific key, *except* that a city
 * with saves which resolve only to city level collapses into a single
 * city-level group. Without it, Bangkok renders as `Thonglor`, `Ari`, and a
 * sibling `Bangkok` meaning "Bangkok, unspecified" — which reads as a bug.
 * With it, Bangkok is one group while Bali, where every save resolves deeper,
 * keeps `Canggu` / `Ubud` / `Uluwatu` apart.
 *
 * A rolled-up group keys on the city, and `?area=` matches by prefix, so it
 * still fetches every nested row.
 *
 * Groups are ordered **largest first** — the cities you actually pick from
 * lead — with name as a stable tie-break.
 */
export function buildLibraryGroups(areas: LibraryAreaCount[]): LibraryGroup[] {
  const byCity = new Map<string, LibraryAreaCount[]>();
  for (const entry of areas) {
    const cityKey = cityKeyOf(entry.area.key);
    const bucket = byCity.get(cityKey);
    if (bucket) bucket.push(entry);
    else byCity.set(cityKey, [entry]);
  }

  const groups: LibraryGroup[] = [];
  for (const [cityKey, entries] of byCity) {
    // The "city, unspecified" entry — saves that resolved no deeper than the city.
    const cityEntry = entries.find((entry) => entry.area.key === cityKey);
    if (cityEntry && entries.length > 1) {
      const count = entries.reduce((sum, entry) => sum + entry.count, 0);
      groups.push(toGroup(cityEntry.area, count));
    } else {
      for (const entry of entries) groups.push(toGroup(entry.area, entry.count));
    }
  }

  return groups.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
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
