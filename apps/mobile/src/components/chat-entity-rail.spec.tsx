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
  uri: 'kebi://area/id/bali/canggu',
  icon: '🏄',
};

const ENTITIES = [
  CANGGU,
  venue('a', "Luigi's Hot Pizza Canggu"),
  venue('b', "Old Man's", '🏖️'),
  venue('c', 'Sand Bar', null),
];

describe('toRailEntities', () => {
  it('keeps venues in mention order and drops areas', () => {
    expect(toRailEntities(ENTITIES).map((e) => e.name)).toEqual([
      "Luigi's Hot Pizza Canggu",
      "Old Man's",
      'Sand Bar',
    ]);
  });

  it('dedupes a venue the answer named twice', () => {
    const twice = [venue('a', "Luigi's"), venue('b', "Old Man's"), venue('a', "Luigi's")];
    expect(toRailEntities(twice).map((e) => e.key)).toEqual(['a', 'b']);
  });
});

describe('ChatEntityRail', () => {
  const noop = () => undefined;

  it('renders a chip per venue with its icon', () => {
    const { getByText } = render(
      <ChatEntityRail entities={ENTITIES} label="mentioned" onOpen={noop} />,
    );

    expect(getByText('mentioned')).toBeTruthy();
    expect(getByText("Luigi's Hot Pizza Canggu")).toBeTruthy();
    expect(getByText('🍕')).toBeTruthy();
    expect(getByText('🏖️')).toBeTruthy();
  });

  it('falls back to the kind glyph when kebi sent no icon', () => {
    // `icon` is nullable by design on both kinds (api-contract.md → ChatEntity).
    const { getByText } = render(
      <ChatEntityRail entities={[venue('c', 'Sand Bar', null)]} label="mentioned" onOpen={noop} />,
    );
    expect(getByText('📍')).toBeTruthy();
  });

  it('renders nothing when the turn named no venues', () => {
    const { toJSON } = render(
      <ChatEntityRail entities={[CANGGU]} label="mentioned" onOpen={noop} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('opens the tapped venue', () => {
    const onOpen = jest.fn();
    const { getByLabelText } = render(
      <ChatEntityRail entities={ENTITIES} label="mentioned" onOpen={onOpen} />,
    );

    fireEvent.press(getByLabelText("Old Man's"));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0][0]).toMatchObject({ key: 'b', kind: 'venue' });
  });
});
