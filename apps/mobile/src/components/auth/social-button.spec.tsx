import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SocialButton } from './social-button';

describe('SocialButton', () => {
  it('renders the label and fires onPress', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <SocialButton glyph={null} label="continue with google" onPress={onPress} />,
    );
    fireEvent.press(getByText('continue with google'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // Regression: disabled dim is an inline `style` opacity, not a toggled
  // `opacity-*` className (NativeWind can leave a removed class's style stuck).
  it('dims to 0.4 opacity when disabled', () => {
    const { getByRole } = render(<SocialButton glyph={null} label="x" disabled />);
    expect(StyleSheet.flatten(getByRole('button').props.style)).toMatchObject({ opacity: 0.4 });
  });

  it('is full opacity when enabled', () => {
    const { getByRole } = render(<SocialButton glyph={null} label="x" />);
    expect(StyleSheet.flatten(getByRole('button').props.style)).toMatchObject({ opacity: 1 });
  });
});
