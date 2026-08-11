import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { NO_CAPABILITIES } from '../capabilities/capability';
import { CapabilitiesProvider } from '../capabilities/capabilities-context';
import { useCurateMenuItem } from './use-curate-menu-item';
import type { CurateTarget } from './curate-sheet-context';

const mockOpen = jest.fn();
jest.mock('./curate-sheet-context', () => ({
  useCurateSheet: () => ({ open: mockOpen }),
}));

const TARGET: CurateTarget = {
  anchor: { place_id: 'place_1' },
  view: { emoji: '🍜', name: 'Kamachiku' },
};

const wrapperFor = (curate: boolean) => {
  const source = () => ({
    capabilities: { ...NO_CAPABILITIES, curate },
    resolved: true,
    revalidate: () => undefined,
  });
  return ({ children }: { children: ReactNode }) => (
    <CapabilitiesProvider source={source}>{children}</CapabilitiesProvider>
  );
};

describe('useCurateMenuItem', () => {
  beforeEach(() => jest.clearAllMocks());

  it('gives an insider the row, in its own group', () => {
    const { result } = renderHook(() => useCurateMenuItem(TARGET), {
      wrapper: wrapperFor(true),
    });

    expect(result.current).toMatchObject({
      emoji: '✍️',
      label: 'add what you know',
      sub: 'everyone will see it',
      // Its own card in the ••• sheet: a public write is neither a personal
      // action nor a destructive one.
      group: 'curate',
    });
  });

  it('gives a non-insider nothing at all — the row is absent, not disabled', () => {
    const { result } = renderHook(() => useCurateMenuItem(TARGET), {
      wrapper: wrapperFor(false),
    });

    expect(result.current).toBeNull();
  });

  it('raises the composer with the target when pressed', () => {
    const { result } = renderHook(() => useCurateMenuItem(TARGET), {
      wrapper: wrapperFor(true),
    });

    result.current?.onPress();

    expect(mockOpen).toHaveBeenCalledWith(TARGET);
  });

  it('denies while the capability is unresolved (fail closed)', () => {
    const source = () => ({
      capabilities: { ...NO_CAPABILITIES, curate: true },
      resolved: false,
      revalidate: () => undefined,
    });
    const { result } = renderHook(() => useCurateMenuItem(TARGET), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <CapabilitiesProvider source={source}>{children}</CapabilitiesProvider>
      ),
    });

    expect(result.current).toBeNull();
  });
});
