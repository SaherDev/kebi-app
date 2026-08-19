import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useLibrarySearch } from './use-library-search';

jest.mock('../api/hooks', () => ({ useApiClient: () => ({}) }));

const mockGetLibrary = jest.fn();
jest.mock('../api/library', () => ({
  getLibrary: (...args: unknown[]) => mockGetLibrary(...args),
}));

const row = (id: string) => ({ user_data: { user_place_id: id } });

function page(ids: string[], next: string | null = null, filteredTotal: number | null = null) {
  return { places: ids.map(row), next_cursor: next, filtered_total: filteredTotal, total: 84 };
}

describe('useLibrarySearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGetLibrary.mockResolvedValue(page(['a'], null, 3));
  });
  afterEach(() => jest.useRealTimers());

  it('sends nothing for an empty query', () => {
    renderHook(() => useLibrarySearch(''));
    act(() => void jest.advanceTimersByTime(1000));

    expect(mockGetLibrary).not.toHaveBeenCalled();
  });

  it('debounces — one request after typing settles, not one per keystroke', async () => {
    const { rerender } = renderHook(({ q }) => useLibrarySearch(q), {
      initialProps: { q: 'ca' },
    });
    rerender({ q: 'can' });
    rerender({ q: 'cang' });
    rerender({ q: 'canggu' });

    expect(mockGetLibrary).not.toHaveBeenCalled();

    act(() => void jest.advanceTimersByTime(250));
    await waitFor(() => expect(mockGetLibrary).toHaveBeenCalledTimes(1));
    expect(mockGetLibrary.mock.calls[0][1]).toMatchObject({ q: 'canggu' });
  });

  it('sends q as a server param — never filters loaded rows', async () => {
    renderHook(() => useLibrarySearch('canggu'));
    act(() => void jest.advanceTimersByTime(250));

    await waitFor(() => expect(mockGetLibrary).toHaveBeenCalled());
    expect(mockGetLibrary.mock.calls[0][1]).toMatchObject({ q: 'canggu', cursor: undefined });
  });

  it('exposes the server filtered_total, not the loaded row count', async () => {
    mockGetLibrary.mockResolvedValue(page(['a', 'b'], 'cur', 37));
    const { result } = renderHook(() => useLibrarySearch('c'));
    act(() => void jest.advanceTimersByTime(250));

    await waitFor(() => expect(result.current.filteredTotal).toBe(37));
    expect(result.current.rows).toHaveLength(2);
  });

  it('clearing the query resets rather than searching for nothing', async () => {
    const { result, rerender } = renderHook(({ q }) => useLibrarySearch(q), {
      initialProps: { q: 'canggu' },
    });
    act(() => void jest.advanceTimersByTime(250));
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    rerender({ q: '' });
    act(() => void jest.advanceTimersByTime(250));

    expect(result.current.rows).toEqual([]);
    expect(result.current.filteredTotal).toBeNull();
    expect(mockGetLibrary).toHaveBeenCalledTimes(1);
  });

  it('appends the next page and stops when the cursor runs out', async () => {
    mockGetLibrary.mockResolvedValueOnce(page(['a'], 'cur', 2));
    const { result } = renderHook(() => useLibrarySearch('c'));
    act(() => void jest.advanceTimersByTime(250));
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    mockGetLibrary.mockResolvedValueOnce(page(['b'], null, 2));
    act(() => void result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(mockGetLibrary.mock.calls[1][1]).toMatchObject({ cursor: 'cur' });

    // No cursor left — a further scroll must not fire another request.
    act(() => void result.current.loadMore());
    expect(mockGetLibrary).toHaveBeenCalledTimes(2);
  });

  it('drops a stale response so a slow "can" cannot overwrite "canggu"', async () => {
    let resolveSlow: ((v: unknown) => void) | undefined;
    mockGetLibrary.mockImplementationOnce(
      () => new Promise((res) => { resolveSlow = res; }),
    );

    const { result, rerender } = renderHook(({ q }) => useLibrarySearch(q), {
      initialProps: { q: 'can' },
    });
    act(() => void jest.advanceTimersByTime(250));
    await waitFor(() => expect(mockGetLibrary).toHaveBeenCalledTimes(1));

    // A newer query lands first.
    mockGetLibrary.mockResolvedValueOnce(page(['fresh'], null, 1));
    rerender({ q: 'canggu' });
    act(() => void jest.advanceTimersByTime(250));
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    // The superseded request now answers — and must be ignored.
    await act(async () => {
      resolveSlow?.(page(['stale', 'stale2'], null, 2));
    });

    expect(result.current.rows).toHaveLength(1);
    expect(result.current.filteredTotal).toBe(1);
  });

  it('surfaces an error and retries the current query', async () => {
    mockGetLibrary.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useLibrarySearch('canggu'));
    act(() => void jest.advanceTimersByTime(250));

    await waitFor(() => expect(result.current.error).toBe(true));

    mockGetLibrary.mockResolvedValueOnce(page(['a'], null, 1));
    act(() => void result.current.retry());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(mockGetLibrary.mock.calls[1][1]).toMatchObject({ q: 'canggu' });
  });
});
