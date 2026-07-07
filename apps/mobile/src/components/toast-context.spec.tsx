import { useEffect } from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Pressable, StyleSheet, Text } from 'react-native';
import { ToastProvider, useToast } from './toast-context';

// Minimal shape of a rendered node we walk — avoids depending on
// react-test-renderer's (untyped) ReactTestInstance.
interface StyledNode {
  props?: { style?: unknown };
  parent: StyledNode | null;
}

type ShowOpts = Parameters<ReturnType<typeof useToast>['show']>[0];

function Trigger({ opts }: { opts: ShowOpts }) {
  const toast = useToast();
  return (
    <Pressable accessibilityRole="button" onPress={() => toast.show(opts)}>
      <Text>trigger</Text>
    </Pressable>
  );
}

// A trigger that holds a top-anchor reservation for its lifetime (mirrors a sheet).
function TopTrigger({ opts }: { opts: ShowOpts }) {
  const toast = useToast();
  useEffect(() => toast.reserveTopAnchor(), [toast]);
  return (
    <Pressable accessibilityRole="button" onPress={() => toast.show(opts)}>
      <Text>trigger</Text>
    </Pressable>
  );
}

// Walk up to the positioned host container and report which edge it anchors to.
function anchorOf(node: StyledNode): 'top' | 'bottom' | null {
  let current: StyledNode | null = node;
  while (current) {
    const style = StyleSheet.flatten(current.props?.style) as { top?: number; bottom?: number };
    if (typeof style?.top === 'number') return 'top';
    if (typeof style?.bottom === 'number') return 'bottom';
    current = current.parent;
  }
  return null;
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

  it('anchors a toast to the bottom by default', () => {
    const { getByText } = render(
      <ToastProvider>
        <Trigger opts={{ text: 'saved!' }} />
      </ToastProvider>,
    );
    act(() => fireEvent.press(getByText('trigger')));
    expect(anchorOf(getByText('saved!'))).toBe('bottom');
  });

  it('anchors to the top while a top-anchor reservation is held (sheet open)', () => {
    const { getByText } = render(
      <ToastProvider>
        <TopTrigger opts={{ text: 'saved!' }} />
      </ToastProvider>,
    );
    act(() => fireEvent.press(getByText('trigger')));
    expect(anchorOf(getByText('saved!'))).toBe('top');
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
