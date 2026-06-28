import { render, fireEvent } from '@testing-library/react-native';
import { QuickPromptChip } from './quick-prompt-chip';

describe('QuickPromptChip', () => {
  it('renders the prompt text', () => {
    const { getByText } = render(<QuickPromptChip text="ramen, no line" onPress={() => undefined} />);
    expect(getByText('ramen, no line')).toBeTruthy();
  });

  it('passes its text to onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<QuickPromptChip text="surprise me" onPress={onPress} />);
    fireEvent.press(getByText('surprise me'));
    expect(onPress).toHaveBeenCalledWith('surprise me');
  });
});
