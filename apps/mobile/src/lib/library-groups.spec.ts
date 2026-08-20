import type { AreaHandle, LibraryAreaCount } from '@kebi-app/shared';
import { buildLibraryGroups, elsewhereCount, orderLibraryGroups } from './library-groups';

/**
 * Names for the parent handles kebi ships alongside a leaf. A key is never a
 * name — since ADR-169 its segments are provider ids — so the fixture has to
 * carry them, exactly as the wire does.
 */
const PARENT_NAMES: Record<string, string> = {
  'th/bangkok': 'Bangkok',
  'id/bali': 'Bali',
  'jp/tokyo': 'Tokyo',
  // The id-path era's Bali — same place, unrecognisable as a string.
  'id/ChIJoQ8Q1Ry0': 'Bali',
};

function area(key: string, name: string, icon: string | null = null): AreaHandle {
  const segments = key.split('/');
  const parentKey = segments.slice(0, -1).join('/');
  const countryCode = segments[0];
  return {
    key,
    name,
    uri: `kebi://area/${key}`,
    icon,
    country_code: countryCode,
    parent: parentKey
      ? {
          key: parentKey,
          name: PARENT_NAMES[parentKey] ?? parentKey,
          uri: `kebi://area/${parentKey}`,
          icon: null,
          country_code: countryCode,
        }
      : null,
  };
}

function count(key: string, name: string, n: number): LibraryAreaCount {
  return { area: area(key, name), count: n };
}

describe('buildLibraryGroups', () => {
  it('keeps neighbourhoods apart when each is big enough to earn a heading', () => {
    const groups = buildLibraryGroups([
      count('id/bali/canggu', 'Canggu', 11),
      count('id/bali/ubud', 'Ubud', 9),
      count('id/bali/uluwatu', 'Uluwatu', 6),
    ]);

    expect(groups.map((g) => g.name)).toEqual(['Canggu', 'Ubud', 'Uluwatu']);
    expect(groups.map((g) => g.count)).toEqual([11, 9, 6]);
  });

  it('folds a city of one-save districts into one group', () => {
    // The real shape that broke this: Bangkok scattered across five districts.
    const groups = buildLibraryGroups([
      count('th/bangkok/pathum-wan', 'Pathum Wan', 2),
      count('th/bangkok/bang-rak', 'Bang Rak', 1),
      count('th/bangkok/chatuchak', 'Chatuchak', 1),
      count('th/bangkok/bang-phae', 'Bang Phae', 1),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ name: 'Bangkok', key: 'th/bangkok', count: 5 });
  });

  it('keeps the big neighbourhood and folds the thin ones beside it', () => {
    const groups = buildLibraryGroups([
      count('id/bali/canggu', 'Canggu', 5),
      count('id/bali/sanur', 'Sanur', 1),
      count('id/bali/amed', 'Amed', 2),
    ]);

    expect(groups.map((g) => g.name)).toEqual(['Canggu', 'Bali']);
    expect(groups.map((g) => g.count)).toEqual([5, 3]);
  });

  it('takes the merged group name and uri from the leaf parent kebi sends', () => {
    const groups = buildLibraryGroups([
      count('th/bangkok/bang-rak', 'Bang Rak', 2),
      count('th/bangkok/chatuchak', 'Chatuchak', 2),
    ]);

    // 2 + 2 clears the bar at city level, so it stops there.
    expect(groups[0].key).toBe('th/bangkok');
    expect(groups[0].uri).toBe('kebi://area/th/bangkok');
  });

  it('keeps folding past the city when the city is thin too', () => {
    // The real shape: eight separate one-save municipalities around Bangkok,
    // no shared city to stop at.
    const groups = buildLibraryGroups([
      count('th/bang-pu-mai', 'Bang Pu Mai', 1),
      count('th/sam-phran', 'Sam Phran', 1),
      count('th/dong-lakhon', 'Dong Lakhon', 1),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('th');
    expect(groups[0].count).toBe(3);
  });

  it('shows the bare code uppercased when nothing can name it', () => {
    // No lookup supplied — the floor must still read as a deliberate country
    // code, not the lowercase key or a name that is merely the key.
    const groups = buildLibraryGroups([
      count('th/bang-pu-mai', 'Bang Pu Mai', 1),
      count('th/sam-phran', 'Sam Phran', 1),
    ]);

    expect(groups[0].name).toBe('TH');
  });

  it('names a folded country from the supplied lookup', () => {
    const names = (code: string) => (code === 'th' ? 'Thailand' : null);
    const groups = buildLibraryGroups(
      [count('th/bang-pu-mai', 'Bang Pu Mai', 1), count('th/sam-phran', 'Sam Phran', 1)],
      null,
      names,
    );

    expect(groups[0].name).toBe('Thailand');
  });

  it('folds a neighbourhood into its city before the city folds onward', () => {
    // Ari alone is thin, but lands in Bangkok first and takes it over the bar.
    const groups = buildLibraryGroups([
      count('th/bangkok/ari', 'Ari', 2),
      count('th/bangkok', 'Bangkok', 1),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('th/bangkok');
    expect(groups[0].count).toBe(3);
  });

  it('records which distribution keys landed in each group', () => {
    const groups = buildLibraryGroups([
      count('th/bangkok/bang-rak', 'Bang Rak', 1),
      count('th/bangkok/chatuchak', 'Chatuchak', 1),
      count('id/bali/canggu', 'Canggu', 5),
    ]);

    const bangkok = groups.find((g) => g.key === 'th')!;
    expect(bangkok.memberKeys.sort()).toEqual(['th/bangkok/bang-rak', 'th/bangkok/chatuchak']);
    expect(groups.find((g) => g.key === 'id/bali/canggu')!.memberKeys).toEqual([
      'id/bali/canggu',
    ]);
  });

  it('never leaves a bare "city, unspecified" sibling', () => {
    const groups = buildLibraryGroups([
      count('th/bangkok/thonglor', 'Thonglor', 4),
      count('th/bangkok/ari', 'Ari', 2),
      count('th/bangkok', 'Bangkok', 3),
    ]);

    // Thonglor earns its heading; Ari and the unspecified saves merge into
    // Bangkok — which then outnumbers it, so it leads.
    expect(groups.map((g) => g.name)).toEqual(['Bangkok', 'Thonglor']);
    expect(groups.map((g) => g.count)).toEqual([5, 4]);
  });

  it('applies the rollup per city, not globally', () => {
    const groups = buildLibraryGroups([
      count('th/bangkok/thonglor', 'Thonglor', 4),
      count('th/bangkok', 'Bangkok', 3),
      count('id/bali/canggu', 'Canggu', 11),
      count('id/bali/ubud', 'Ubud', 2),
    ]);

    // Canggu and Thonglor stand; Bangkok's own 3 stands; Ubud is thin and
    // folds through Bali to its country.
    expect(groups.map((g) => g.name)).toEqual(['Canggu', 'Thonglor', 'Bangkok', 'ID']);
    expect(groups.map((g) => g.count)).toEqual([11, 4, 3, 2]);
  });

  it('leaves a lone city-level entry as its own group', () => {
    const groups = buildLibraryGroups([count('jp/tokyo', 'Tokyo', 5)]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('jp/tokyo');
    expect(groups[0].count).toBe(5);
  });

  it('orders largest first, breaking ties by name', () => {
    const groups = buildLibraryGroups([
      count('id/bali/ubud', 'Ubud', 4),
      count('jp/tokyo/nezu', 'Nezu', 9),
      count('id/bali/canggu', 'Canggu', 4),
    ]);

    expect(groups.map((g) => g.name)).toEqual(['Nezu', 'Canggu', 'Ubud']);
  });



  it('carries the area uri and icon through', () => {
    const entry: LibraryAreaCount = { area: area('id/bali/canggu', 'Canggu', '🏄'), count: 3 };

    expect(buildLibraryGroups([entry])[0]).toMatchObject({
      uri: 'kebi://area/id/bali/canggu',
      icon: '🏄',
    });
  });

  it('returns nothing for an empty distribution', () => {
    expect(buildLibraryGroups([])).toEqual([]);
  });
});

describe('orderLibraryGroups', () => {
  const bali = [
    count('id/bali/canggu', 'Canggu', 5),
    count('id/bali/uluwatu', 'Uluwatu', 3),
  ];
  const vietnam = [count('vn/da-nang', 'Da Nang', 4)];

  it('leads with the country you are in, largest within it', () => {
    const groups = buildLibraryGroups([...bali, ...vietnam], 'id');

    // Da Nang outnumbers Uluwatu, but standing in Bali you want Bali together.
    expect(groups.map((g) => g.name)).toEqual(['Canggu', 'Uluwatu', 'Da Nang']);
  });

  it('falls back to largest-first when the country is unknown', () => {
    const groups = buildLibraryGroups([...bali, ...vietnam]);

    expect(groups.map((g) => g.name)).toEqual(['Canggu', 'Da Nang', 'Uluwatu']);
  });

  it('matches the country case-insensitively', () => {
    const groups = buildLibraryGroups([...bali, ...vietnam], 'ID');

    expect(groups[0].name).toBe('Canggu');
    expect(groups[2].name).toBe('Da Nang');
  });

  it('re-orders without a refetch when the country arrives late', () => {
    const built = buildLibraryGroups([...bali, ...vietnam]);
    expect(built.map((g) => g.name)).toEqual(['Canggu', 'Da Nang', 'Uluwatu']);

    expect(orderLibraryGroups(built, 'vn').map((g) => g.name)).toEqual([
      'Da Nang',
      'Canggu',
      'Uluwatu',
    ]);
  });

  it('does not mutate the array it was given', () => {
    const built = buildLibraryGroups([...bali, ...vietnam]);
    const before = built.map((g) => g.name);

    orderLibraryGroups(built, 'vn');

    expect(built.map((g) => g.name)).toEqual(before);
  });
});

describe('elsewhereCount', () => {
  it("takes kebi's served count over anything derivable", () => {
    // The derived answer here would be 4; the served one is the truth, and it
    // is right before the library has finished paging in.
    const areas = [count('id/bali/canggu', 'Canggu', 11), count('jp/tokyo', 'Tokyo', 5)];

    expect(elsewhereCount(3, areas, 20)).toBe(3);
  });

  it('trusts a served zero — every save resolved to an area', () => {
    expect(elsewhereCount(0, [count('id/bali/canggu', 'Canggu', 11)], 20)).toBe(0);
  });

  it('falls back to total minus what keyed when kebi sends no count', () => {
    const areas = [count('id/bali/canggu', 'Canggu', 11), count('jp/tokyo', 'Tokyo', 5)];

    expect(elsewhereCount(null, areas, 20)).toBe(4);
  });

  it('is zero when every save keyed', () => {
    expect(elsewhereCount(null, [count('id/bali', 'Bali', 8)], 8)).toBe(0);
  });

  it('is zero when the total is unknown, rather than a wrong number', () => {
    expect(elsewhereCount(null, [count('id/bali', 'Bali', 8)], null)).toBe(0);
  });

  it('never goes negative if counts and total disagree mid-rollout', () => {
    expect(elsewhereCount(null, [count('id/bali', 'Bali', 8)], 3)).toBe(0);
  });
});

describe('opaque geo keys (ADR-169)', () => {
  // What kebi actually sends since the geo-identity migration: the country
  // code, then provider place ids. Nothing below the head is renderable.
  const CANGGU = 'id/ChIJoQ8Q1Ry0/ChIJZZZYbadung';
  const UBUD = 'id/ChIJoQ8Q1Ry0/ChIJUUUUubud';

  it('never puts a key segment in a heading', () => {
    // 2 + 2 clears the bar at city level, so the fold stops there.
    const groups = buildLibraryGroups([count(CANGGU, 'Canggu', 2), count(UBUD, 'Ubud', 2)]);

    // Both are thin, so they fold to a city the distribution only described as
    // a parent — the old code printed that key. Now it reads as a name.
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Bali');
    expect(groups[0].name).not.toContain('ChIJ');
    expect(groups[0].name).not.toContain('/');
  });

  it('falls back to the country, never the key, when nothing names a group', () => {
    // A leaf whose parent handle kebi never sent: unnameable, and its key is
    // unprintable. The country is what is left.
    const orphan: LibraryAreaCount = {
      area: {
        key: 'jp/ChIJXXXXtokyo/ChIJYYYYnezu',
        name: 'Nezu',
        uri: 'kebi://area/token',
        icon: null,
        country_code: 'jp',
        parent: null,
      },
      count: 1,
    };

    const groups = buildLibraryGroups([orphan], null, (code) =>
      code === 'jp' ? 'Japan' : null,
    );

    expect(groups[0].name).toBe('Japan');
  });

  it('orders home-first from country_code, with no handle on the fold target', () => {
    const groups = buildLibraryGroups(
      [count(CANGGU, 'Canggu', 2), count(UBUD, 'Ubud', 2), count('vn/ChIJDaNang', 'Da Nang', 9)],
      'id',
    );

    // Da Nang is far bigger, but standing in Indonesia, Bali leads.
    expect(groups.map((g) => g.name)).toEqual(['Bali', 'Da Nang']);
  });

  it('still orders home-first mid-rollout, before country_code ships', () => {
    // A kebi from before the deploy: no country_code anywhere. The key's head
    // is the ISO code in both eras, which is what the fallback leans on.
    const stripped = [count(CANGGU, 'Canggu', 5), count('vn/ChIJDaNang', 'Da Nang', 9)].map(
      (entry) => ({
        count: entry.count,
        area: { ...entry.area, country_code: null, parent: null },
      }),
    );

    expect(buildLibraryGroups(stripped, 'id')[0].name).toBe('Canggu');
  });
});
