import { render, fireEvent, screen } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import { OtpInput } from './otp-input';

// Reanimated needs its Jest mock (the row shake uses shared values).
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Re-query each time — boxes re-render (and their onChange closures refresh) as
// digits fill, so a stale reference would carry an old state snapshot.
const inputs = () => screen.UNSAFE_getAllByType(TextInput);

describe('OtpInput', () => {
  it('fires onComplete with the code once all six digits are entered', () => {
    const onComplete = jest.fn();
    render(<OtpInput onComplete={onComplete} />);
    '492810'.split('').forEach((digit, i) => fireEvent.changeText(inputs()[i], digit));
    expect(onComplete).toHaveBeenCalledWith('492810');
  });

  it('distributes a pasted/autofilled code across the boxes', () => {
    const onComplete = jest.fn();
    render(<OtpInput onComplete={onComplete} />);
    fireEvent.changeText(inputs()[0], '492810');
    expect(onComplete).toHaveBeenCalledWith('492810');
  });

  it('strips non-digits and does not complete on junk input', () => {
    const onComplete = jest.fn();
    render(<OtpInput onComplete={onComplete} />);
    fireEvent.changeText(inputs()[0], 'a');
    expect(onComplete).not.toHaveBeenCalled();
  });
});
