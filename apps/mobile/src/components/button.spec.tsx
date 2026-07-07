import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Button } from './button';

describe('Button', () => {
  // Regression: the disabled dim must be an inline `style` opacity, not a
  // toggled `opacity-*` className — NativeWind can leave a removed class's style
  // stuck, which left buttons grey-forever. Assert the resolved opacity directly.
  it('dims to 0.4 opacity when disabled', () => {
    const { getByRole } = render(<Button label="save" disabled />);
    expect(StyleSheet.flatten(getByRole('button').props.style)).toMatchObject({ opacity: 0.4 });
  });

  it('is full opacity when enabled', () => {
    const { getByRole } = render(<Button label="save" />);
    expect(StyleSheet.flatten(getByRole('button').props.style)).toMatchObject({ opacity: 1 });
  });

  it('renders the label and fires onPress', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button label="save" onPress={onPress} />);
    fireEvent.press(getByText('save'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button label="save" onPress={onPress} disabled />);
    fireEvent.press(getByText('save'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders each variant', () => {
    const { getByText } = render(
      <>
        <Button variant="primary" label="primary" />
        <Button variant="outlined" label="outlined" />
        <Button variant="danger" label="danger" />
      </>,
    );
    expect(getByText('primary')).toBeTruthy();
    expect(getByText('outlined')).toBeTruthy();
    expect(getByText('danger')).toBeTruthy();
  });
});
