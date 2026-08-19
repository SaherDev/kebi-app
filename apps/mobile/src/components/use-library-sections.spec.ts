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

function area(key: string, name: string) {
  return { key, name, uri: `kebi://area/${key}`, icon: null, parent: null };
}

function row(id: string, hasArea = true) {
  return { user_data: { user_place_id: id }, area: hasArea ? area('id/bali', 'Bali') : null };
}

function page(rows: unknown[], next: string | null = null, total = 20) {
  return { places: rows, next_cursor: next, total, filtered_total: total };
}

describe('useLibrarySections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLibraryAreas.mockResolvedValue({
      areas: [
        { area: area('id/bali/canggu', 'Canggu'), count: 11 },
        { area: area('jp/tokyo', 'Tokyo'), count: 5 },
      ],
    });
    mockGetLibrary.mockResolvedValue(page([row('a')], null, 16));
  });

  it('builds sections from the distribution, largest first', async () => {
    const { result } = renderHook(() => useLibrarySections());

    await waitFor(() => expect(result.current.sections).toHaveLength(2));
    expect(result.current.sections.map((s) => s.group.name)).toEqual(['Canggu', 'Tokyo']);
    expect(result.current.sections.map((s) => s.group.count)).toEqual([11, 5]);
  });

  it('takes the hero total from the library read, not the section counts', async () => {
    const { result } = renderHook(() => useLibrarySections());

    await waitFor(() => expect(result.current.total).toBe(16));
  });

  it('loads only the first section up front, by area key', async () => {
    const { result } = renderHook(() => useLibrarySections());

    await waitFor(() => expect(result.current.sections).toHaveLength(2));
    expect(mockGetLibrary).toHaveBeenCalledTimes(1);
    expect(mockGetLibrary.mock.calls[0][1]).toMatchObject({ area: 'id/bali/canggu' });
    expect(result.current.sections[1].rows).toEqual([]);
  });

  it('advances to the next section on loadMore', async () => {
    const { result } = renderHook(() => useLibrarySections());
    await waitFor(() => expect(result.current.sections[0].rows).toHaveLength(1));

    mockGetLibrary.mockResolvedValueOnce(page([row('b')], null, 16));
    act(() => void result.current.loadMore());

    await waitFor(() => expect(result.current.sections[1].rows).toHaveLength(1));
    expect(mockGetLibrary.mock.calls[1][1]).toMatchObject({ area: 'jp/tokyo' });
  });

  it('finishes a multi-page section before starting the next', async () => {
    mockGetLibrary.mockReset();
    mockGetLibrary.mockResolvedValueOnce(page([row('a')], 'cur', 16));
    const { result } = renderHook(() => useLibrarySections());
    await waitFor(() => expect(result.current.sections[0].rows).toHaveLength(1));

    mockGetLibrary.mockResolvedValueOnce(page([row('a2')], null, 16));
    act(() => void result.current.loadMore());
    await waitFor(() => expect(result.current.sections[0].rows).toHaveLength(2));

    // Still the same area — the cursor was carried, not dropped for the next section.
    expect(mockGetLibrary.mock.calls[1][1]).toMatchObject({
      area: 'id/bali/canggu',
      cursor: 'cur',
    });
  });

  it('adds an elsewhere bucket for saves the distribution could not key', async () => {
    // 11 + 5 keyed, 20 total → 4 with no area.
    mockGetLibrary.mockResolvedValue(page([row('a')], null, 20));
    const { result } = renderHook(() => useLibrarySections());

    await waitFor(() => expect(result.current.sections).toHaveLength(3));
    const last = result.current.sections[2];
    expect(last.group.key).toBe(ELSEWHERE_KEY);
    expect(last.group.count).toBe(4);
    expect(last.tappable).toBe(false);
  });

  it('omits the elsewhere bucket when every save keyed', async () => {
    mockGetLibrary.mockResolvedValue(page([row('a')], null, 16));
    const { result } = renderHook(() => useLibrarySections());

    await waitFor(() => expect(result.current.sections).toHaveLength(2));
    expect(result.current.sections.some((s) => s.group.key === ELSEWHERE_KEY)).toBe(false);
  });

  it('reads elsewhere off the plain library and keeps only keyless rows', async () => {
    mockGetLibrary.mockReset();
    // First section, then the elsewhere read.
    mockGetLibrary.mockResolvedValueOnce(page([row('a')], null, 20));
    mockGetLibrary.mockResolvedValueOnce(page([row('keyed')], null, 20));
    mockGetLibrary.mockResolvedValueOnce(
      page([row('orphan', false), row('keyed2')], null, 20),
    );

    const { result } = renderHook(() => useLibrarySections());
    await waitFor(() => expect(result.current.sections).toHaveLength(3));

    act(() => void result.current.loadMore()); // Tokyo
    await waitFor(() => expect(result.current.sections[1].rows).toHaveLength(1));
    act(() => void result.current.loadMore()); // elsewhere
    await waitFor(() => expect(result.current.sections[2].rows).toHaveLength(1));

    // The plain read carried both; only the keyless one belongs here.
    expect(result.current.sections[2].rows[0].user_data.user_place_id).toBe('orphan');
    // And it was fetched without an area param — no key can select these.
    expect(mockGetLibrary.mock.calls[2][1].area).toBeUndefined();
  });

  it('surfaces an error when the distribution fails', async () => {
    mockGetLibraryAreas.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useLibrarySections());

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.sections).toEqual([]);
  });

  it('still reports a total when the user has no areas at all', async () => {
    mockGetLibraryAreas.mockResolvedValueOnce({ areas: [] });
    mockGetLibrary.mockResolvedValueOnce(page([], null, 0));
    const { result } = renderHook(() => useLibrarySections());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.total).toBe(0);
    expect(result.current.sections).toEqual([]);
  });

  it('drops a row locally across every section', async () => {
    const { result } = renderHook(() => useLibrarySections());
    await waitFor(() => expect(result.current.sections[0].rows).toHaveLength(1));

    act(() => void result.current.removeLocally('a'));

    expect(result.current.sections[0].rows).toEqual([]);
  });

  it('patches one row in place', async () => {
    const { result } = renderHook(() => useLibrarySections());
    await waitFor(() => expect(result.current.sections[0].rows).toHaveLength(1));

    act(() =>
      void result.current.patchLocally('a', {
        user_place_id: 'a',
        visited: true,
      } as never),
    );

    expect(result.current.sections[0].rows[0].user_data.visited).toBe(true);
  });
});
