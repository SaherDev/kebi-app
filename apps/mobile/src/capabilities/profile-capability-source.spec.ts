import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useProfileCapabilitySource } from './profile-capability-source';

const mockStatus = { value: 'authenticated' as string };
jest.mock('../auth/auth-context', () => ({
  useAuth: () => ({ status: mockStatus.value }),
}));

jest.mock('../api/hooks', () => ({
  useApiClient: () => ({}),
}));

const mockGetProfile = jest.fn();
// The factory may only close over `mock`-prefixed names (jest's hoisting rule).
jest.mock('../api/profile', () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
}));

describe('useProfileCapabilitySource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus.value = 'authenticated';
  });

  it('reports the granted capability once the profile lands', async () => {
    mockGetProfile.mockResolvedValueOnce({ name: '', email: '', plan: 'explorer', can_curate: true });

    const { result } = renderHook(() => useProfileCapabilitySource());

    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current.capabilities.curate).toBe(true);
  });

  it('starts denied and unresolved before anything lands', () => {
    mockGetProfile.mockReturnValueOnce(new Promise(() => undefined));

    const { result } = renderHook(() => useProfileCapabilitySource());

    expect(result.current.resolved).toBe(false);
    expect(result.current.capabilities.curate).toBe(false);
  });

  it('fails closed when the read errors — never falls back to the last good answer', async () => {
    mockGetProfile.mockResolvedValueOnce({ name: '', email: '', plan: 'explorer', can_curate: true });
    const { result, rerender } = renderHook(() => useProfileCapabilitySource());
    await waitFor(() => expect(result.current.capabilities.curate).toBe(true));

    // Now the network breaks and we re-ask. Stale permission is the one failure
    // this layer exists to prevent, so the previous `true` must not survive.
    mockGetProfile.mockRejectedValueOnce(new Error('offline'));
    act(() => result.current.revalidate());
    rerender(undefined);

    await waitFor(() => expect(result.current.capabilities.curate).toBe(false));
    expect(result.current.resolved).toBe(true);
  });

  it('clears the grant on sign-out without asking the server', async () => {
    mockGetProfile.mockResolvedValueOnce({ name: '', email: '', plan: 'explorer', can_curate: true });
    const { result, rerender } = renderHook(() => useProfileCapabilitySource());
    await waitFor(() => expect(result.current.capabilities.curate).toBe(true));

    mockGetProfile.mockClear();
    mockStatus.value = 'unauthenticated';
    rerender(undefined);

    // Authoritative without a request: signed out is a known denial, so gated UI
    // never hangs on a fetch that would 401 anyway.
    await waitFor(() => expect(result.current.capabilities.curate).toBe(false));
    expect(result.current.resolved).toBe(true);
    expect(mockGetProfile).not.toHaveBeenCalled();
  });

  it('permits nothing and stays unresolved while auth is still loading', () => {
    mockStatus.value = 'loading';

    const { result } = renderHook(() => useProfileCapabilitySource());

    expect(result.current.resolved).toBe(false);
    expect(result.current.capabilities.curate).toBe(false);
    expect(mockGetProfile).not.toHaveBeenCalled();
  });

  it('re-reads on revalidate, picking up a fresh grant', async () => {
    mockGetProfile.mockResolvedValueOnce({ name: '', email: '', plan: 'explorer', can_curate: false });
    const { result, rerender } = renderHook(() => useProfileCapabilitySource());
    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current.capabilities.curate).toBe(false);

    mockGetProfile.mockResolvedValueOnce({ name: '', email: '', plan: 'explorer', can_curate: true });
    act(() => result.current.revalidate());
    rerender(undefined);

    await waitFor(() => expect(result.current.capabilities.curate).toBe(true));
  });
});
