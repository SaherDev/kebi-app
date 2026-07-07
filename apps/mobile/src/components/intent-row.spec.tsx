import { render, fireEvent } from '@testing-library/react-native';
import { IntentRow } from './intent-row';

describe('IntentRow', () => {
  const TEXT = "coffee, quiet, nowhere i've been";

  it('renders the query in quotes with a relative timestamp', () => {
    // A recent instant relative to now → "today, …" (deterministic prefix).
    const createdAt = new Date().toISOString();
    const { getByText } = render(
      <IntentRow text={TEXT} createdAt={createdAt} onPress={() => undefined} />,
    );
    expect(getByText(`"${TEXT}"`)).toBeTruthy();
    expect(getByText(/today,/)).toBeTruthy();
  });

  it('passes its verbatim text to onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <IntentRow text={TEXT} createdAt={new Date().toISOString()} onPress={onPress} />,
    );
    fireEvent.press(getByText(`"${TEXT}"`));
    expect(onPress).toHaveBeenCalledWith(TEXT);
  });
});
