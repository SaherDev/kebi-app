import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useShareResults } from './use-share-results';

const mockStore = {
  available: true,
  pending: [] as unknown[],
  queue: [] as unknown[],
};

jest.mock('../lib/share-storage', () => ({
  canShareInBackground: () => mockStore.available,
  readPendingShares: () => mockStore.pending,
  writePendingShares: (items: unknown[]) => {
    mockStore.pending = items;
    return true;
  },
  readShareQueue: () => mockStore.queue,
  writeShareQueue: (items: unknown[]) => {
    mockStore.queue = items;
    return true;
  },
  recordShareOutcome: (id: string, outcome: unknown) => {
    mockStore.pending = mockStore.pending.map((p) =>
      (p as { id: string }).id === id ? { ...(p as object), outcome } : p,
    );
    return true;
  },
}));

const mockExtract = jest.fn();
jest.mock('../api/extract', () => ({
  extractPlace: (...args: unknown[]) => mockExtract(...args),
  EXTRACT_GRACE_MS: 5000,
  EXTRACT_TIMEOUT_MS: 90000,
}));

jest.mock('../api/hooks', () => ({ useApiClient: () => ({}) }));

beforeEach(() => {
  mockStore.available = true;
  mockStore.pending = [];
  mockStore.queue = [];
  mockExtract.mockReset();
});

describe('useShareResults', () => {
  it('reports a share with no outcome yet as still working', async () => {
    // The extension handed it to iOS; nothing has come back. "Working" is the
    // only truthful thing to say.
    mockStore.pending = [{ id: 'a', raw_input: 'https://tiktok.com/x', shared_at: 1 }];

    const { result } = renderHook(() => useShareResults());

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.rows[0].state).toBe('working');
  });

  it('leads with the caption the host app gave us, not the url', async () => {
    // Nobody recognises vt.tiktok.com/ZSVSVQqHe — they recognise what it said.
    mockStore.pending = [
      {
        id: 'a',
        raw_input: 'https://vt.tiktok.com/ZSVSVQqHe/',
        title: 'partying in Uluwatu hits different',
        shared_at: 1,
      },
    ];

    const { result } = renderHook(() => useShareResults());

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.rows[0].label).toBe('partying in Uluwatu hits different');
    expect(result.current.rows[0].source).toBe('tiktok');
  });

  it('names it by source and time when the share carried no text', async () => {
    // TikTok supplies no caption, and vt.tiktok.com/ZSVSVQqHe is not something
    // anyone recognises — "the tiktok I shared at 10:28" is.
    mockStore.pending = [{ id: 'a', raw_input: 'https://vt.tiktok.com/ZSVSVQqHe/', shared_at: 1 }];

    const { result } = renderHook(() => useShareResults());

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.rows[0].label).toMatch(/^tiktok · /);
    expect(result.current.rows[0].label).not.toContain('ZSVSVQqHe');
  });

  it('reports a delivered success as landed, with its place names', async () => {
    mockStore.pending = [
      {
        id: 'a',
        raw_input: 'https://tiktok.com/x',
        shared_at: 1,
        outcome: { status: 'completed', place_names: ['Warung Bu Mi'] },
      },
    ];

    const { result } = renderHook(() => useShareResults());

    await waitFor(() => expect(result.current.rows[0].state).toBe('landed'));
    expect(result.current.rows[0].placeNames).toEqual(['Warung Bu Mi']);
  });

  it('reports a delivered failure, carrying the reason', async () => {
    mockStore.pending = [
      {
        id: 'a',
        raw_input: 'https://instagram.com/reel/x',
        shared_at: 1,
        outcome: { status: 'failed', place_names: [], failure_reason: 'unsupported_url' },
      },
    ];

    const { result } = renderHook(() => useShareResults());

    await waitFor(() => expect(result.current.rows[0].state).toBe('failed'));
    expect(result.current.rows[0].failureReason).toBe('unsupported_url');
  });

  it('treats a completed response with no results as a failure, not a success', async () => {
    mockStore.pending = [
      { id: 'a', raw_input: 'x', shared_at: 1, outcome: { status: 'completed', place_names: [] } },
    ];

    const { result } = renderHook(() => useShareResults());

    await waitFor(() => expect(result.current.rows[0].state).toBe('failed'));
  });

  describe('the fallback queue', () => {
    it('sends what the extension could not, and lands it', async () => {
      mockStore.queue = [{ raw_input: 'https://tiktok.com/x', shared_at: 5 }];
      mockExtract.mockResolvedValue({
        status: 'completed',
        results: [{ place: { place_name: 'Secret Spot' } }],
        failure_reason: null,
      });

      const { result } = renderHook(() => useShareResults());

      await waitFor(() => expect(result.current.rows[0]?.state).toBe('landed'));
      expect(result.current.rows[0].placeNames).toEqual(['Secret Spot']);
      // Emptied, so a relaunch cannot send it a second time.
      expect(mockStore.queue).toEqual([]);
    });

    it('sends every queued link at once rather than one after another', async () => {
      mockStore.queue = [
        { raw_input: 'a', shared_at: 1 },
        { raw_input: 'b', shared_at: 2 },
        { raw_input: 'c', shared_at: 3 },
      ];
      mockExtract.mockResolvedValue({ status: 'failed', results: [], failure_reason: 'no_candidates' });

      renderHook(() => useShareResults());

      await waitFor(() => expect(mockExtract).toHaveBeenCalledTimes(3));
    });

    it('leaves a link that failed in transport as working, not failed', async () => {
      // The next open may well resolve it; claiming failure would be a guess.
      mockStore.queue = [{ raw_input: 'a', shared_at: 1 }];
      mockExtract.mockRejectedValue(new Error('offline'));

      const { result } = renderHook(() => useShareResults());

      await waitFor(() => expect(result.current.rows).toHaveLength(1));
      expect(result.current.rows[0].state).toBe('working');
    });

    it('records a domain failure with its reason', async () => {
      mockStore.queue = [{ raw_input: 'a', shared_at: 1 }];
      mockExtract.mockResolvedValue({
        status: 'failed',
        results: [],
        failure_reason: 'save_limit_reached',
      });

      const { result } = renderHook(() => useShareResults());

      await waitFor(() => expect(result.current.rows[0]?.state).toBe('failed'));
      expect(result.current.rows[0].failureReason).toBe('save_limit_reached');
    });
  });

  it('renders nothing where there is no App Group to read', async () => {
    mockStore.available = false;
    mockStore.pending = [{ id: 'a', raw_input: 'x', shared_at: 1 }];

    const { result } = renderHook(() => useShareResults());

    await waitFor(() => expect(result.current.rows).toEqual([]));
  });

  it('clears for good on dismiss', async () => {
    mockStore.pending = [{ id: 'a', raw_input: 'x', shared_at: 1 }];
    const { result } = renderHook(() => useShareResults());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    act(() => result.current.dismiss());

    expect(result.current.rows).toEqual([]);
    expect(mockStore.pending).toEqual([]);
  });
});
