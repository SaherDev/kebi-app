import { render } from '@testing-library/react-native';
import { SmartInput } from './smart-input';
import type { AuthChannel } from '../../auth/detect-channel';

// Reanimated needs its Jest mock (same pattern as splash.spec) — the component
// uses useSharedValue / useAnimatedStyle / withSequence for the invalid shake.
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

const EMAIL_HINT = 'looks like an email';
const PHONE_HINT = 'looks like a phone number';

function renderInput(channel: AuthChannel) {
  return render(
    <SmartInput
      value="x"
      onChangeText={() => undefined}
      channel={channel}
      placeholder="email or phone number"
      emailHint={EMAIL_HINT}
      phoneHint={PHONE_HINT}
    />,
  );
}

describe('SmartInput', () => {
  it('shows the email hint and not the phone hint when channel is email', () => {
    const { getByText, queryByText } = renderInput('email');
    expect(getByText(EMAIL_HINT)).toBeTruthy();
    expect(queryByText(PHONE_HINT)).toBeNull();
  });

  it('shows the phone hint when channel is phone', () => {
    const { getByText, queryByText } = renderInput('phone');
    expect(getByText(PHONE_HINT)).toBeTruthy();
    expect(queryByText(EMAIL_HINT)).toBeNull();
  });

  it('hides both hints when channel is ambiguous or empty', () => {
    const ambiguous = renderInput('ambiguous');
    expect(ambiguous.queryByText(EMAIL_HINT)).toBeNull();
    expect(ambiguous.queryByText(PHONE_HINT)).toBeNull();

    const empty = renderInput('empty');
    expect(empty.queryByText(EMAIL_HINT)).toBeNull();
    expect(empty.queryByText(PHONE_HINT)).toBeNull();
  });
});
