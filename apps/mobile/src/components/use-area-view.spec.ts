import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAreaView } from './use-area-view';

const mockGetArea = jest.fn();

jest.mock('../api/hooks', () => ({ useApiClient: () => ({}) }));
jest.mock('../api/area', () => ({
  getArea: (...args: unknown[]) => mockGetArea(...args),
}));

const AREA_ID = 'aWQvYmFsaS9jYW5nZ3U';

const thin = { key: 'id/bali/canggu', name: 'Canggu', summary: null, profiled: false };
const dressed = {
  key: 'id/bali/canggu',
  name: 'Canggu',
  summary: 'the surf-and-laptop end of bali.',
  profiled: true,
};

describe('useAreaView', () => {
  beforeEach(() => {
    mockGetArea.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fetches the area and reports ready', async () => {
    mockGetArea.mockResolvedValue(dressed);

    const { result } = renderHook(() => useAreaView(AREA_ID));

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(mockGetArea).toHaveBeenCalledTimes(1);
    expect(mockGetArea.mock.calls[0][1]).toBe(AREA_ID);
  });

  it('does not ask twice for an area that came back dressed', async () => {
    mockGetArea.mockResolvedValue(dressed);

    renderHook(() => useAreaView(AREA_ID));
    await waitFor(() => expect(mockGetArea).toHaveBeenCalledTimes(1));

    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    expect(mockGetArea).toHaveBeenCalledTimes(1);
  });

  it('refetches once for a thin first open, and paints the dressed profile', async () => {
    // The first open is what triggers kebi's profiler (ADR-153), so the summary
    // exists seconds later — waiting for the user to leave and come back would
    // strand them on a bare header.
    mockGetArea.mockResolvedValueOnce(thin).mockResolvedValueOnce(dressed);

    const { result } = renderHook(() => useAreaView(AREA_ID));
    await waitFor(() => expect(result.current.state.view?.profiled).toBe(false));

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => expect(result.current.state.view?.summary).toBe(dressed.summary));
    expect(mockGetArea).toHaveBeenCalledTimes(2);
  });

  it('stops after the one retry — a still-thin area is not polled', async () => {
    mockGetArea.mockResolvedValue(thin);

    renderHook(() => useAreaView(AREA_ID));
    await waitFor(() => expect(mockGetArea).toHaveBeenCalledTimes(1));

    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(mockGetArea).toHaveBeenCalledTimes(2);
  });

  it('fails when the first load throws', async () => {
    mockGetArea.mockRejectedValue(new Error('404'));

    const { result } = renderHook(() => useAreaView(AREA_ID));

    await waitFor(() => expect(result.current.state.status).toBe('failed'));
  });

  it('keeps a painted screen when the retry throws', async () => {
    // Blanking a screen the user is already reading is worse than a thin one.
    mockGetArea.mockResolvedValueOnce(thin).mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useAreaView(AREA_ID));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.state.status).toBe('ready');
    expect(result.current.state.view?.name).toBe('Canggu');
  });

  it('cannot resolve without an id, and says so is not worth retrying', () => {
    const { result } = renderHook(() => useAreaView(undefined));

    expect(result.current.state.status).toBe('failed');
    // Nothing about tapping again could produce an id (ADR-056), so the screen
    // must not offer a retry for this one.
    expect(result.current.state).toMatchObject({ retryable: false });
    expect(mockGetArea).not.toHaveBeenCalled();
  });

  it('retries a failed read, and reports ready when the second try lands', async () => {
    mockGetArea.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(dressed);

    const { result } = renderHook(() => useAreaView(AREA_ID));
    await waitFor(() => expect(result.current.state.status).toBe('failed'));
    expect(result.current.state).toMatchObject({ retryable: true });

    await act(async () => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(mockGetArea).toHaveBeenCalledTimes(2);
  });
});
