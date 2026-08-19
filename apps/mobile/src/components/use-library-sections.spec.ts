import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useLibrarySections, ELSEWHERE_KEY } from './use-library-sections';

jest.mock('../api/hooks', () => ({ useApiClient: () => ({}) }));
// The screen's focus effect is expo-router's; here it should run once on mount.
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(cb, [cb]);
  },
}));

const mockGetLibrary = jest.fn();
const mockGetLibraryAreas = jest.fn();
jest.mock('../api/library', () => ({
  getLibrary: (...args: unknown[]) => mockGetLibrary(...args),
  getLibraryAreas: (...args: unknown[]) => mockGetLibraryAreas(...args),
}));

const mockLocation = jest.fn();
const mockCountry = jest.fn();
const mockCity = jest.fn();
jest.mock('../lib/location', () => ({
  getDeviceLocation: () => mockLocation(),
  getDeviceCountryCode: () => mockCountry(),
  getDeviceCity: () => mockCity(),
}));

function area(key: string, name: string) {
  const parentKey = key.split('/').slice(0, -1).join('/');
  return {
    key,
    name,
    uri: `kebi://area/${key}`,
    icon: null,
    parent: parentKey
      ? { key: parentKey, name: parentKey, uri: `kebi://area/${parentKey}`, icon: null }
      : null,
  };
}

/** A saved row sitting in `areaKey` (or nowhere, for the elsewhere bucket). */
function row(id: string, areaKey: string | null) {
  return { user_data: { user_place_id: id }, area: areaKey ? area(areaKey, areaKey) : null };
}

function page(rows: unknown[], next: string | null = null, total = 20) {
  return { places: rows, next_cursor: next, total, filtered_total: total };
}

describe('useLibrarySections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLibraryAreas.mockResolvedValue({
      areas: [
        { area: area('id/bali/canggu', 'Canggu'), count: 5 },
        { area: area('jp/tokyo', 'Tokyo'), count: 3 },
      ],
    });
    mockGetLibrary.mockResolvedValue(
      page([row('a', 'id/bali/canggu'), row('b', 'jp/tokyo')], null, 8),
    );
    mockLocation.mockResolvedValue(null);
    mockCountry.mockResolvedValue(null);
    mockCity.mockResolvedValue(null);
  });

  it('badges the area the device is standing in', async () => {
    mockLocation.mockResolvedValue({ lat: -8.65, lng: 115.13 });
    mockCountry.mockResolvedValue('id');
    mockCity.mockResolvedValue('Canggu');

    const { result } = renderHook(() => useLibrarySections());

    await waitFor(() => expect(result.current.sections[0].here).toBe(true));
    // Only the one you're in.
    expect(result.current.sections[1].here).toBe(false);
  });

  it('badges nothing when the locality matches no group', async () => {
    mockLocation.mockResolvedValue({ lat: 1, lng: 1 });
    mockCountry.mockResolvedValue('id');
    mockCity.mockResolvedValue('Nowhere');

    const { result } = renderHook(() => useLibrarySections());

    await waitFor(() => expect(result.current.sections).toHaveLength(2));
    expect(result.current.sections.some((s) => s.here)).toBe(false);
  });

  it('draws every section from one library read, not one per group', async () => {
    const { result } = renderHook(() => useLibrarySections());

    await waitFor(() => expect(result.current.sections).toHaveLength(2));
    // One page of rows plus one distribution — not a request per section.
    expect(mockGetLibrary).toHaveBeenCalledTimes(1);
    expect(mockGetLibraryAreas).toHaveBeenCalledTimes(1);
    expect(mockGetLibrary.mock.calls[0][1]).toMatchObject({ limit: 50 });
  });

  it('files each row under its heading', async () => {
    const { result } = renderHook(() => useLibrarySections());

    await waitFor(() => expect(result.current.sections).toHaveLength(2));
    expect(result.current.sections[0].group.name).toBe('Canggu');
    expect(result.current.sections[0].rows.map((r) => r.user_data.user_place_id)).toEqual(['a']);
    expect(result.current.sections[1].rows.map((r) => r.user_data.user_place_id)).toEqual(['b']);
  });

  it('shows the whole-library count, not the number of rows loaded', async () => {
    const { result } = renderHook(() => useLibrarySections());

    await waitFor(() => expect(result.current.sections).toHaveLength(2));
    // One Canggu row is loaded; the heading still says the true five.
    expect(result.current.sections[0].rows).toHaveLength(1);
    expect(result.current.sections[0].group.count).toBe(5);
  });

  it('never renders a heading with no rows under it', async () => {
    // Tokyo is in the distribution but none of its rows are on this page.
    mockGetLibrary.mockResolvedValue(page([row('a', 'id/bali/canggu')], 'cur', 8));
    const { result } = renderHook(() => useLibrarySections());

    await waitFor(() => expect(result.current.sections).toHaveLength(1));
    expect(result.current.sections[0].group.name).toBe('Canggu');
    expect(result.current.sections.every((s) => s.rows.length > 0)).toBe(true);
  });

  it('takes the hero total from the library read', async () => {
    const { result } = renderHook(() => useLibrarySections());

    await waitFor(() => expect(result.current.total).toBe(8));
  });

  it('leads with the country the device is in, once the fix arrives', async () => {
    mockGetLibraryAreas.mockResolvedValue({
      areas: [
        { area: area('vn/da-nang', 'Da Nang'), count: 4 },
        { area: area('id/bali/canggu', 'Canggu'), count: 5 },
        { area: area('id/bali/uluwatu', 'Uluwatu'), count: 3 },
      ],
    });
    mockGetLibrary.mockResolvedValue(
      page(
        [row('a', 'id/bali/canggu'), row('b', 'id/bali/uluwatu'), row('c', 'vn/da-nang')],
        null,
        12,
      ),
    );
    mockLocation.mockResolvedValue({ lat: -8.65, lng: 115.13 });
    mockCountry.mockResolvedValue('id');
    mockCity.mockResolvedValue(null);

    const { result } = renderHook(() => useLibrarySections());

    // Da Nang outnumbers Uluwatu, but standing in Bali keeps Bali together.
    await waitFor(() =>
      expect(result.current.sections.map((s) => s.group.name)).toEqual([
        'Canggu',
        'Uluwatu',
        'Da Nang',
      ]),
    );
  });

  it('buckets keyless saves into elsewhere, pinned last', async () => {
    mockGetLibrary.mockResolvedValue(
      page([row('orphan', null), row('a', 'id/bali/canggu')], null, 9),
    );
    const { result } = renderHook(() => useLibrarySections());

    await waitFor(() => expect(result.current.sections).toHaveLength(2));
    const last = result.current.sections[1];
    expect(last.group.key).toBe(ELSEWHERE_KEY);
    expect(last.tappable).toBe(false);
    expect(last.rows.map((r) => r.user_data.user_place_id)).toEqual(['orphan']);
    // 9 total minus the 8 the distribution keyed.
    expect(last.group.count).toBe(1);
  });

  it('omits elsewhere entirely when every save keyed', async () => {
    const { result } = renderHook(() => useLibrarySections());

    await waitFor(() => expect(result.current.sections).toHaveLength(2));
    expect(result.current.sections.some((s) => s.group.key === ELSEWHERE_KEY)).toBe(false);
  });

  it('appends the next page into its sections', async () => {
    mockGetLibrary.mockResolvedValueOnce(page([row('a', 'id/bali/canggu')], 'cur', 8));
    const { result } = renderHook(() => useLibrarySections());
    await waitFor(() => expect(result.current.sections).toHaveLength(1));

    mockGetLibrary.mockResolvedValueOnce(page([row('b', 'jp/tokyo')], null, 8));
    act(() => void result.current.loadMore());

    await waitFor(() => expect(result.current.sections).toHaveLength(2));
    expect(mockGetLibrary.mock.calls[1][1]).toMatchObject({ cursor: 'cur' });
  });

  it('does not page past the last cursor', async () => {
    const { result } = renderHook(() => useLibrarySections());
    await waitFor(() => expect(result.current.sections).toHaveLength(2));

    act(() => void result.current.loadMore());

    expect(mockGetLibrary).toHaveBeenCalledTimes(1);
  });

  it('surfaces an error when either read fails', async () => {
    mockGetLibraryAreas.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useLibrarySections());

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.sections).toEqual([]);
  });

  it('drops a row locally', async () => {
    const { result } = renderHook(() => useLibrarySections());
    await waitFor(() => expect(result.current.sections).toHaveLength(2));

    act(() => void result.current.removeLocally('a'));

    // Canggu had one row; with it gone the section goes too.
    await waitFor(() => expect(result.current.sections).toHaveLength(1));
    expect(result.current.sections[0].group.name).toBe('Tokyo');
  });

  it('patches one row in place', async () => {
    const { result } = renderHook(() => useLibrarySections());
    await waitFor(() => expect(result.current.sections).toHaveLength(2));

    act(() =>
      void result.current.patchLocally('a', { user_place_id: 'a', visited: true } as never),
    );

    expect(result.current.sections[0].rows[0].user_data.visited).toBe(true);
  });
});
