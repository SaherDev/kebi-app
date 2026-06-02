import { render, fireEvent, act } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { ToastProvider, useToast } from './toast-context';

function Trigger({ opts }: { opts: Parameters<ReturnType<typeof useToast>['show']>[0] }) {
  const toast = useToast();
  return (
    <Pressable accessibilityRole="button" onPress={() => toast.show(opts)}>
      <Text>trigger</Text>
    </Pressable>
  );
}

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it('shows a toast on show() and auto-dismisses after 3s', () => {
    const { getByText, queryByText } = render(
      <ToastProvider>
        <Trigger opts={{ text: 'saved!' }} />
      </ToastProvider>,
    );
    act(() => fireEvent.press(getByText('trigger')));
    expect(getByText('saved!')).toBeTruthy();
    act(() => jest.advanceTimersByTime(3000));
    expect(queryByText('saved!')).toBeNull();
  });

  it('fires the action handler when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <ToastProvider>
        <Trigger opts={{ text: 'removed', action: { label: 'undo', onPress } }} />
      </ToastProvider>,
    );
    act(() => fireEvent.press(getByText('trigger')));
    act(() => fireEvent.press(getByText('undo')));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
