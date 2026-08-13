import { fireEvent, render } from '@testing-library/react-native';
import type { ChatEntity } from '@kebi-app/shared';
import { ChatEntityRail, toRailEntities } from './chat-entity-rail';

const venue = (key: string, name: string, icon: string | null = '🍕'): ChatEntity => ({
  kind: 'venue',
  key,
  name,
  uri: `kebi://venue/${key}`,
  icon,
});

const CANGGU: ChatEntity = {
  kind: 'area',
  key: 'id/bali/canggu',
  name: 'Canggu',
  uri: 'kebi://area/aWQvYmFsaS9jYW5nZ3U',
  icon: '🏄',
};

const ENTITIES = [
  CANGGU,
  venue('a', "Luigi's Hot Pizza Canggu"),
  venue('b', "Old Man's", '🏖️'),
  venue('c', 'Sand Bar', null),
];

describe('toRailEntities', () => {
  it('keeps both kinds in mention order — an area is a destination too', () => {
    expect(toRailEntities(ENTITIES).map((e) => e.name)).toEqual([
      'Canggu',
      "Luigi's Hot Pizza Canggu",
      "Old Man's",
      'Sand Bar',
    ]);
  });

  it('leaves a late-mentioned area where the answer put it', () => {
    // Hoisting the scope would contradict the sentence the rail indexes.
    const lateArea = [venue('a', "Luigi's"), CANGGU];
    expect(toRailEntities(lateArea).map((e) => e.name)).toEqual(["Luigi's", 'Canggu']);
  });

  it('dedupes an entity the answer named twice', () => {
    const twice = [venue('a', "Luigi's"), venue('b', "Old Man's"), venue('a', "Luigi's")];
    expect(toRailEntities(twice).map((e) => e.key)).toEqual(['a', 'b']);
  });

  it('keeps a venue and an area that share a key — different id spaces', () => {
    const collide = [venue('x', 'Ubud Bar'), { ...CANGGU, key: 'x' }];
    expect(toRailEntities(collide)).toHaveLength(2);
  });

  it('never gives a web source a slot — a citation is inline-only (ADR-161)', () => {
    const fifa: ChatEntity = {
      kind: 'web',
      key: 'https://www.fifa.com/schedule',
      name: 'fifa.com',
      uri: 'kebi://web/aHR0cHM6Ly9maWZhLmNvbQ',
      icon: '🌐',
    };

    // Option a of kebi-chat-web-source-options.html, locked: the rail indexes
    // places you can go; the source's tap lives on the inline domain mention.
    expect(toRailEntities([fifa, ...ENTITIES]).map((e) => e.kind)).toEqual([
      'area',
      'venue',
      'venue',
      'venue',
    ]);
  });
});

describe('ChatEntityRail', () => {
  const noop = () => undefined;

  it('renders a chip per entity with its icon', () => {
    const { getByText } = render(
      <ChatEntityRail entities={ENTITIES} label="mentioned" onOpen={noop} />,
    );

    expect(getByText('mentioned')).toBeTruthy();
    expect(getByText('Canggu')).toBeTruthy();
    expect(getByText("Luigi's Hot Pizza Canggu")).toBeTruthy();
    expect(getByText('🏄')).toBeTruthy();
    expect(getByText('🍕')).toBeTruthy();
  });

  it('falls back to the kind glyph when kebi sent no icon', () => {
    // `icon` is nullable by design on both kinds (api-contract.md → ChatEntity).
    const { getByText } = render(
      <ChatEntityRail entities={[venue('c', 'Sand Bar', null)]} label="mentioned" onOpen={noop} />,
    );
    expect(getByText('📍')).toBeTruthy();
  });

  it('gives an area the venue chip unchanged — the emoji is the difference', () => {
    const { getByText } = render(
      <ChatEntityRail entities={[{ ...CANGGU, icon: null }]} label="mentioned" onOpen={noop} />,
    );
    expect(getByText('🗺️')).toBeTruthy();
  });

  it('renders nothing when the turn named nowhere', () => {
    const { toJSON } = render(<ChatEntityRail entities={[]} label="mentioned" onOpen={noop} />);
    expect(toJSON()).toBeNull();
  });

  it('opens the tapped entity', () => {
    const onOpen = jest.fn();
    const { getByLabelText } = render(
      <ChatEntityRail entities={ENTITIES} label="mentioned" onOpen={onOpen} />,
    );

    fireEvent.press(getByLabelText('Canggu'));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0][0]).toMatchObject({ key: 'id/bali/canggu', kind: 'area' });
  });
});
