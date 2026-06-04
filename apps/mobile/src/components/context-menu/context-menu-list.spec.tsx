import { fireEvent, render } from '@testing-library/react-native';
import { ContextMenuList } from './context-menu-list';
import type { ContextMenuItem } from './context-menu-types';

const items: ContextMenuItem[] = [
  { emoji: '👍', label: 'looks right', onPress: jest.fn() },
  { emoji: '❤️', label: 'i like this one', onPress: jest.fn() },
  { emoji: '🗑️', label: 'forget this place', destructive: true, onPress: jest.fn() },
];

describe('ContextMenuList', () => {
  it('renders every item label and emoji', () => {
    const { getByText } = render(<ContextMenuList items={items} onSelect={jest.fn()} />);
    expect(getByText('looks right')).toBeTruthy();
    expect(getByText('forget this place')).toBeTruthy();
    expect(getByText('🗑️')).toBeTruthy();
  });

  it('runs the item onPress then closes via onSelect', () => {
    const onSelect = jest.fn();
    const onPress = jest.fn();
    const { getByText } = render(
      <ContextMenuList items={[{ emoji: '👍', label: 'looks right', onPress }]} onSelect={onSelect} />,
    );
    fireEvent.press(getByText('looks right'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('marks the destructive row with the danger token class', () => {
    const { getByText } = render(<ContextMenuList items={items} onSelect={jest.fn()} />);
    const destructive = getByText('forget this place');
    expect(destructive.props.className).toContain('text-danger');
  });
});
