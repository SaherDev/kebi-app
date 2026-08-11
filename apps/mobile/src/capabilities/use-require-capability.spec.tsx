import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { NO_CAPABILITIES } from './capability';
import type { CapabilityState } from './capability-source';
import { CapabilitiesProvider } from './capabilities-context';
import { useRequireCapability } from './use-require-capability';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const wrapperFor = (state: Partial<CapabilityState>) => {
  const source = () => ({
    capabilities: NO_CAPABILITIES,
    resolved: false,
    revalidate: () => undefined,
    ...state,
  });
  return ({ children }: { children: ReactNode }) => (
    <CapabilitiesProvider source={source}>{children}</CapabilitiesProvider>
  );
};

describe('useRequireCapability', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lets a permitted caller render and does not navigate', () => {
    const { result } = renderHook(() => useRequireCapability('curate'), {
      wrapper: wrapperFor({ capabilities: { curate: true }, resolved: true }),
    });

    expect(result.current).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('bounces a denied caller off the route', () => {
    // The deep-link / share-extension / stale-back-stack case: the screen is
    // reachable without ever passing the entry point we hid.
    const { result } = renderHook(() => useRequireCapability('curate'), {
      wrapper: wrapperFor({ capabilities: { curate: false }, resolved: true }),
    });

    expect(result.current).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('replaces rather than pushes, so back cannot walk straight in again', () => {
    renderHook(() => useRequireCapability('curate', '/settings'), {
      wrapper: wrapperFor({ capabilities: { curate: false }, resolved: true }),
    });

    expect(mockReplace).toHaveBeenCalledWith('/settings');
  });

  it('renders nothing but does NOT navigate while the answer is unresolved', () => {
    // Ejecting on an unresolved read would throw a legitimate insider off the
    // screen every cold start.
    const { result } = renderHook(() => useRequireCapability('curate'), {
      wrapper: wrapperFor({ capabilities: { curate: true }, resolved: false }),
    });

    expect(result.current).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
