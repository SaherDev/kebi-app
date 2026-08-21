import { act, fireEvent, render } from '@testing-library/react-native';
import { BootWait } from './boot-wait';

jest.mock('../i18n/context', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('BootWait', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('waits quietly, then reassures, then offers a way out', () => {
    const onRetry = jest.fn();
    const { queryByText, getByText, getByLabelText } = render(<BootWait onRetry={onRetry} />);

    // A short wait says nothing — silence is fine for a second or two.
    expect(queryByText('boot.waking')).toBeNull();

    act(() => jest.advanceTimersByTime(5000));
    expect(getByText('boot.waking')).toBeTruthy();

    // Past the threshold the wait becomes a statement with an action — the one
    // thing the design system requires of every error (ADR-056).
    act(() => jest.advanceTimersByTime(10000));
    expect(getByText('boot.stalled')).toBeTruthy();
    expect(queryByText('boot.waking')).toBeNull();

    fireEvent.press(getByLabelText('common.retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
