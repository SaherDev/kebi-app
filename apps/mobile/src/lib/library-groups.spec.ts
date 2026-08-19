import type { AreaHandle, LibraryAreaCount } from '@kebi-app/shared';
import { buildLibraryGroups, elsewhereCount, orderLibraryGroups } from './library-groups';

function area(key: string, name: string, icon: string | null = null): AreaHandle {
  const segments = key.split('/');
  const parentKey = segments.slice(0, -1).join('/');
  return {
    key,
    name,
    uri: `kebi://area/${key}`,
    icon,
    parent: parentKey
      ? { key: parentKey, name: parentKey, uri: `kebi://area/${parentKey}`, icon: null }
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
    expect(groups[0]).toMatchObject({ name: 'th/bangkok', key: 'th/bangkok', count: 5 });
  });

  it('keeps the big neighbourhood and folds the thin ones beside it', () => {
    const groups = buildLibraryGroups([
      count('id/bali/canggu', 'Canggu', 5),
      count('id/bali/sanur', 'Sanur', 1),
      count('id/bali/amed', 'Amed', 2),
    ]);

    expect(groups.map((g) => g.name)).toEqual(['Canggu', 'id/bali']);
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

  it('shows the bare code uppercased when the runtime cannot resolve it', () => {
    const original = Intl.DisplayNames;
    // Hermes support for DisplayNames varies; the floor must still read as a
    // deliberate country code, not a broken lowercase string.
    (Intl as { DisplayNames?: unknown }).DisplayNames = undefined;
    try {
      const groups = buildLibraryGroups([
        count('th/bang-pu-mai', 'Bang Pu Mai', 1),
        count('th/sam-phran', 'Sam Phran', 1),
      ]);
      expect(groups[0].name).toBe('TH');
    } finally {
      (Intl as { DisplayNames?: unknown }).DisplayNames = original;
    }
  });

  it('names a folded country from its code rather than showing "th"', () => {
    const groups = buildLibraryGroups([
      count('th/bang-pu-mai', 'Bang Pu Mai', 1),
      count('th/sam-phran', 'Sam Phran', 1),
    ]);

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
    // folds through Bali to Indonesia.
    expect(groups.map((g) => g.name)).toEqual(['Canggu', 'Thonglor', 'Bangkok', 'Indonesia']);
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
  it('is the grand total minus everything that keyed', () => {
    const areas = [count('id/bali/canggu', 'Canggu', 11), count('jp/tokyo', 'Tokyo', 5)];

    expect(elsewhereCount(areas, 20)).toBe(4);
  });

  it('is zero when every save keyed', () => {
    expect(elsewhereCount([count('id/bali', 'Bali', 8)], 8)).toBe(0);
  });

  it('is zero when the total is unknown, rather than a wrong number', () => {
    expect(elsewhereCount([count('id/bali', 'Bali', 8)], null)).toBe(0);
  });

  it('never goes negative if counts and total disagree mid-rollout', () => {
    expect(elsewhereCount([count('id/bali', 'Bali', 8)], 3)).toBe(0);
  });
});
