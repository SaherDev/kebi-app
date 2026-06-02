import { render, fireEvent } from '@testing-library/react-native';
import { Button } from './button';

describe('Button', () => {
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
