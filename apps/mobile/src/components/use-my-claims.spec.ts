import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useMyClaims } from './use-my-claims';

jest.mock('../api/hooks', () => ({ useApiClient: () => ({}) }));

const mockShow = jest.fn();
jest.mock('./toast-context', () => ({
  useToast: () => ({ show: mockShow, dismiss: jest.fn(), reserveTopAnchor: () => () => undefined }),
}));

const mockList = jest.fn();
const mockRetract = jest.fn();
jest.mock('../api/knowledge', () => ({
  listClaims: (...a: unknown[]) => mockList(...a),
  retractClaim: (...a: unknown[]) => mockRetract(...a),
}));

const anchor = (name: string, type: 'place' | 'area' = 'place') => ({
  type,
  place_id: type === 'place' ? `${name}-id` : null,
  area_id: type === 'area' ? `${name}-token` : null,
  name,
  groupKey: `${type}:${name}-id`,
  emoji: type === 'area' ? '🗺️' : '📍',
});

const claim = (id: string, text: string, a = anchor('Kamachiku')) => ({
  id,
  scope: 'place',
  claim: text,
  tags: [],
  created_at: '2026-08-10T12:00:00Z',
  anchor: a,
});

/** The last toast's undo action. */
const undo = () => mockShow.mock.calls.at(-1)?.[0].action.onPress as () => void;

describe('useMyClaims', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockList.mockResolvedValue({
      claims: [
        claim('c1', 'go at 11:30'),
        claim('c2', 'ask for the brick room'),
        claim('c3', 'south of the tracks', anchor('Shimokitazawa', 'area')),
      ],
      next_cursor: null,
    });
    mockRetract.mockResolvedValue(undefined);
  });
  afterEach(() => jest.useRealTimers());

  it('groups notes by what they are about, not by when they were written', async () => {
    const { result } = renderHook(() => useMyClaims());

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    const state = result.current.state;
    if (state.status !== 'ready') throw new Error('not ready');

    expect(state.groups).toHaveLength(2);
    expect(state.groups[0].anchor.name).toBe('Kamachiku');
    expect(state.groups[0].claims).toHaveLength(2);
    expect(state.groups[1].anchor.name).toBe('Shimokitazawa');
    expect(state.total).toBe(3);
  });

  it('surfaces a load failure rather than an empty list', async () => {
    mockList.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useMyClaims());

    await waitFor(() => expect(result.current.state.status).toBe('failed'));
  });

  describe('retract', () => {
    it('hides the note immediately, before any request', async () => {
      const { result } = renderHook(() => useMyClaims());
      await waitFor(() => expect(result.current.state.status).toBe('ready'));

      act(() => result.current.retract(claim('c1', 'go at 11:30')));

      const state = result.current.state;
      if (state.status !== 'ready') throw new Error('not ready');
      expect(state.total).toBe(2);
      // Deferred: nothing has been deleted yet.
      expect(mockRetract).not.toHaveBeenCalled();
    });

    it('commits the DELETE only after the undo window elapses', async () => {
      const { result } = renderHook(() => useMyClaims());
      await waitFor(() => expect(result.current.state.status).toBe('ready'));

      act(() => result.current.retract(claim('c1', 'go at 11:30')));
      act(() => void jest.advanceTimersByTime(5000));

      expect(mockRetract).toHaveBeenCalledWith({}, 'c1');
    });

    it('undo brings the note back and never sends the DELETE', async () => {
      const { result } = renderHook(() => useMyClaims());
      await waitFor(() => expect(result.current.state.status).toBe('ready'));

      act(() => result.current.retract(claim('c1', 'go at 11:30')));
      act(() => undo()());
      act(() => void jest.advanceTimersByTime(10000));

      const state = result.current.state;
      if (state.status !== 'ready') throw new Error('not ready');
      expect(state.total).toBe(3);
      // Deferring is the point: an undo needs no compensating write, so a
      // global claim is never deleted-then-recreated.
      expect(mockRetract).not.toHaveBeenCalled();
    });

    it('restores the row and says so when the delete fails', async () => {
      mockRetract.mockRejectedValueOnce(new Error('offline'));
      const { result } = renderHook(() => useMyClaims());
      await waitFor(() => expect(result.current.state.status).toBe('ready'));

      act(() => result.current.retract(claim('c1', 'go at 11:30')));
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        const state = result.current.state;
        if (state.status !== 'ready') throw new Error('not ready');
        // A note the user believes is gone but isn't would be worse than the
        // failure itself.
        expect(state.total).toBe(3);
      });
      expect(mockShow.mock.calls.at(-1)?.[0].text).toBe("couldn't remove that one");
    });

    it('offers undo on the toast, per the destructive-action rule', async () => {
      const { result } = renderHook(() => useMyClaims());
      await waitFor(() => expect(result.current.state.status).toBe('ready'));

      act(() => result.current.retract(claim('c1', 'go at 11:30')));

      const toast = mockShow.mock.calls.at(-1)?.[0];
      expect(toast.text).toBe('note removed');
      expect(toast.action.label).toBe('undo');
    });
  });
});
