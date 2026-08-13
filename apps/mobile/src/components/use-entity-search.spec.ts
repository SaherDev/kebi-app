import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useEntitySearch } from './use-entity-search';

jest.mock('../api/hooks', () => ({ useApiClient: () => ({}) }));

const mockSearch = jest.fn();
jest.mock('../api/knowledge', () => ({
  ENTITY_SEARCH_MIN_LENGTH: 2,
  searchEntities: (...args: unknown[]) => mockSearch(...args),
}));

const hit = (name: string) => ({ name });

describe('useEntitySearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockSearch.mockResolvedValue([hit('Canggu')]);
  });
  afterEach(() => jest.useRealTimers());

  it('asks for nothing below the minimum term length', () => {
    renderHook(() => useEntitySearch('c'));
    act(() => void jest.advanceTimersByTime(1000));

    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('debounces — one request after typing settles, not one per keystroke', async () => {
    const { rerender } = renderHook(({ q }) => useEntitySearch(q), {
      initialProps: { q: 'ca' },
    });
    rerender({ q: 'can' });
    rerender({ q: 'cang' });
    rerender({ q: 'canggu' });

    // Nothing yet: each keystroke restarted the timer.
    expect(mockSearch).not.toHaveBeenCalled();

    act(() => void jest.advanceTimersByTime(250));
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1));
    expect(mockSearch).toHaveBeenCalledWith({}, 'canggu');
  });

  it('returns the hits once they land', async () => {
    const { result } = renderHook(() => useEntitySearch('canggu'));
    act(() => void jest.advanceTimersByTime(250));

    await waitFor(() => expect(result.current.results).toHaveLength(1));
    expect(result.current.loading).toBe(false);
  });

  it('reports empty only after a query actually came back with nothing', async () => {
    mockSearch.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useEntitySearch('zzzz'));
    expect(result.current.empty).toBe(false); // not yet asked

    act(() => void jest.advanceTimersByTime(250));
    await waitFor(() => expect(result.current.empty).toBe(true));
  });

  it('fails soft — a broken request leaves the composer usable, not blocked', async () => {
    mockSearch.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useEntitySearch('canggu'));
    act(() => void jest.advanceTimersByTime(250));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.results).toEqual([]);
  });

  it('clears results when the term drops back below the minimum', async () => {
    const { result, rerender } = renderHook(({ q }) => useEntitySearch(q), {
      initialProps: { q: 'canggu' },
    });
    act(() => void jest.advanceTimersByTime(250));
    await waitFor(() => expect(result.current.results).toHaveLength(1));

    rerender({ q: 'c' });
    expect(result.current.results).toEqual([]);
  });
});
