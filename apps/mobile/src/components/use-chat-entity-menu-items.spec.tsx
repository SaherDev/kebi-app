import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import type { ChatEntity } from '@kebi-app/shared';
import { NO_CAPABILITIES } from '../capabilities/capability';
import { CapabilitiesProvider } from '../capabilities/capabilities-context';
import { useChatEntityMenuItems } from './use-chat-entity-menu-items';
import { chatEntityCurateTarget } from './use-curate-menu-item';

const mockOpenSheet = jest.fn();
jest.mock('./curate-sheet-context', () => ({
  useCurateSheet: () => ({ open: mockOpenSheet }),
}));

const VENUE: ChatEntity = {
  kind: 'venue',
  key: 'place_1',
  name: "Luigi's",
  uri: 'kebi://venue/place_1',
  icon: '🍝',
};
const AREA: ChatEntity = {
  kind: 'area',
  key: 'id/bali/canggu',
  name: 'Canggu',
  uri: 'kebi://area/aWQvYmFsaS9jYW5nZ3U',
  icon: '🏄',
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

describe('useChatEntityMenuItems', () => {
  const onOpen = jest.fn();
  beforeEach(() => jest.clearAllMocks());

  it('gives an insider open + the write row', () => {
    const { result } = renderHook(() => useChatEntityMenuItems(VENUE, onOpen), {
      wrapper: wrapperFor(true),
    });

    expect(result.current.map((i) => i.label)).toEqual(['open', 'add what you know']);
  });

  it('gives everyone else just open — the gesture still does something', () => {
    const { result } = renderHook(() => useChatEntityMenuItems(VENUE, onOpen), {
      wrapper: wrapperFor(false),
    });

    expect(result.current.map((i) => i.label)).toEqual(['open']);
  });

  it('open hands the entity back to the navigation handler', () => {
    const { result } = renderHook(() => useChatEntityMenuItems(AREA, onOpen), {
      wrapper: wrapperFor(true),
    });

    result.current[0].onPress();

    expect(onOpen).toHaveBeenCalledWith(AREA);
  });

  it('offers the write row for an area too — curating needs no save', () => {
    const { result } = renderHook(() => useChatEntityMenuItems(AREA, onOpen), {
      wrapper: wrapperFor(true),
    });

    expect(result.current.map((i) => i.label)).toContain('add what you know');
  });
});

describe('chatEntityCurateTarget', () => {
  it("anchors a venue by its key, which *is* places.id", () => {
    expect(chatEntityCurateTarget(VENUE)).toMatchObject({
      anchor: { place_id: 'place_1' },
      view: { emoji: '🍝', name: "Luigi's" },
    });
  });

  it('anchors an area by the token off its uri, never its raw geo key', () => {
    // `key` here is `id/bali/canggu` — a slash path no endpoint accepts. Reading
    // it instead of the uri token is what silently unanchors every area note.
    expect(chatEntityCurateTarget(AREA).anchor).toEqual({ area_id: 'aWQvYmFsaS9jYW5nZ3U' });
  });
});
