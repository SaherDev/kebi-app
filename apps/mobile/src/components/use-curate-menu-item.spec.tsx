import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { NO_CAPABILITIES } from '../capabilities/capability';
import { CapabilitiesProvider } from '../capabilities/capabilities-context';
import {
  areaCurateTarget,
  placeCurateTarget,
  useCurateMenuItem,
  withCurateItem,
} from './use-curate-menu-item';
import type { CurateTarget } from './curate-sheet-context';
import type { ContextMenuItem } from './context-menu/context-menu-types';

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

  describe('withCurateItem', () => {
    const item = (label: string, destructive = false): ContextMenuItem => ({
      emoji: '·',
      label,
      destructive,
      onPress: () => undefined,
    });
    const CURATE = item('add what you know');

    it('slots the row before the destructive items, never after them', () => {
      // The long-press menu draws its divider before the first destructive item,
      // so appending would land a public write below "forget this place".
      const menu = [item('looks right'), item('been there'), item('forget', true)];

      expect(withCurateItem(menu, CURATE).map((i) => i.label)).toEqual([
        'looks right',
        'been there',
        'add what you know',
        'forget',
      ]);
    });

    it('appends when the menu has no destructive item', () => {
      const menu = [item('open'), item('save it')];

      expect(withCurateItem(menu, CURATE).map((i) => i.label)).toEqual([
        'open',
        'save it',
        'add what you know',
      ]);
    });

    it('returns the menu untouched for a non-insider', () => {
      const menu = [item('looks right'), item('forget', true)];

      expect(withCurateItem(menu, null)).toBe(menu);
    });
  });

  describe('areaCurateTarget', () => {
    it('anchors by the token off the uri, never the raw geo key', () => {
      expect(
        areaCurateTarget({
          uri: 'kebi://area/aWQvYmFsaS9jYW5nZ3U',
          name: 'Canggu',
          icon: '🏄',
          context: 'Bali',
        }),
      ).toMatchObject({
        anchor: { area_id: 'aWQvYmFsaS9jYW5nZ3U' },
        view: { emoji: '🏄', name: 'Canggu', context: 'Bali' },
      });
    });

    it('falls back to the area glyph when kebi sent no icon', () => {
      const target = areaCurateTarget({ uri: 'kebi://area/tok', name: 'Nezu', icon: null });
      expect(target.view?.emoji).toBeTruthy();
    });

    it('sends no anchor when the uri carries no decodable token', () => {
      expect(areaCurateTarget({ uri: 'not-a-kebi-uri', name: 'X', icon: null }).anchor).toBeUndefined();
    });
  });

  describe('placeCurateTarget', () => {
    const place = (id: string | null) =>
      ({
        id,
        place_name: 'Single Fin Bali',
        icon: '🏄',
        categories: [],
        location: { city: 'Bali' },
      }) as never;

    it('anchors to the place id', () => {
      expect(placeCurateTarget(place('place_1'))).toMatchObject({
        anchor: { place_id: 'place_1' },
        view: { name: 'Single Fin Bali', context: 'Bali' },
      });
    });

    it('sends no anchor when the place has no catalog id, rather than a wrong one', () => {
      expect(placeCurateTarget(place(null)).anchor).toBeUndefined();
    });
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
