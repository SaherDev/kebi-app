import type { AreaHandle, LibraryAreaCount } from '@kebi-app/shared';
import { buildLibraryGroups, elsewhereCount } from './library-groups';

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
  it('keeps neighbourhoods apart when every save resolves deeper', () => {
    const groups = buildLibraryGroups([
      count('id/bali/canggu', 'Canggu', 11),
      count('id/bali/ubud', 'Ubud', 9),
      count('id/bali/uluwatu', 'Uluwatu', 6),
    ]);

    expect(groups.map((g) => g.name)).toEqual(['Canggu', 'Ubud', 'Uluwatu']);
    expect(groups.map((g) => g.count)).toEqual([11, 9, 6]);
  });

  it('rolls a city up when some saves resolve only to city level', () => {
    const groups = buildLibraryGroups([
      count('th/bangkok/thonglor', 'Thonglor', 4),
      count('th/bangkok/ari', 'Ari', 2),
      count('th/bangkok', 'Bangkok', 3),
    ]);

    // One group, not three — and no "Bangkok, unspecified" sibling.
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Bangkok');
    expect(groups[0].key).toBe('th/bangkok');
    expect(groups[0].count).toBe(9);
  });

  it('applies the rollup per city, not globally', () => {
    const groups = buildLibraryGroups([
      count('th/bangkok/thonglor', 'Thonglor', 4),
      count('th/bangkok', 'Bangkok', 3),
      count('id/bali/canggu', 'Canggu', 11),
      count('id/bali/ubud', 'Ubud', 2),
    ]);

    // Bangkok collapses; Bali does not.
    expect(groups.map((g) => g.name)).toEqual(['Canggu', 'Bangkok', 'Ubud']);
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

  it('keys a rolled-up group on the city so ?area= prefix-matches its rows', () => {
    const groups = buildLibraryGroups([
      count('th/bangkok/thonglor', 'Thonglor', 4),
      count('th/bangkok', 'Bangkok', 1),
    ]);

    expect(groups[0].key).toBe('th/bangkok');
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
