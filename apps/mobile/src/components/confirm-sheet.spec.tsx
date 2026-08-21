import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ConfirmSheet } from './confirm-sheet';

const mockChain = (): unknown => new Proxy({}, { get: () => () => mockChain() });
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: (p: { children: unknown }) => p.children,
  GestureDetector: (p: { children: unknown }) => p.children,
  Gesture: { Pan: () => mockChain() },
}));
jest.mock('../i18n/context', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('../lib/haptics', () => ({ triggerHaptic: jest.fn() }));

const props = {
  open: true,
  title: 'nuke everything?',
  body: 'wipes your saved places.',
  confirmLabel: 'nuke my data',
  busyLabel: 'nuking',
  failedText: 'nothing was deleted.',
  onClose: () => undefined,
};

describe('ConfirmSheet', () => {
  it('holds while a destructive action runs, then releases', async () => {
    let settle!: () => void;
    const onConfirm = jest.fn(() => new Promise<void>((resolve) => (settle = resolve)));
    const { getByLabelText } = render(<ConfirmSheet {...props} onConfirm={onConfirm} />);

    fireEvent.press(getByLabelText('nuke my data'));

    // The label goes present-tense and cancel is disabled — a slow wipe must
    // not be indistinguishable from a no-op (ADR-056).
    await waitFor(() => expect(getByLabelText('nuking')).toBeTruthy());
    expect(getByLabelText('settings.cancel').props.accessibilityState).toMatchObject({
      disabled: true,
    });

    // And a second tap can't fire a second wipe.
    fireEvent.press(getByLabelText('nuking'));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    settle();
    await waitFor(() => expect(getByLabelText('nuke my data')).toBeTruthy());
  });

  it('stays open and says nothing was deleted when it fails', async () => {
    const onConfirm = jest.fn(() => Promise.reject(new Error('offline')));
    const { getByText, getByLabelText } = render(<ConfirmSheet {...props} onConfirm={onConfirm} />);

    fireEvent.press(getByLabelText('nuke my data'));

    // With a destructive action, the state of the data is the whole message.
    await waitFor(() => expect(getByText(/nothing was deleted\./)).toBeTruthy());
    expect(getByLabelText('common.retry')).toBeTruthy();
  });

  it('leaves a synchronous action alone', () => {
    // The share history's "clear" is local storage — instant and unable to
    // fail, so it must not be held behind a spinner.
    const onConfirm = jest.fn();
    const { getByLabelText, queryByLabelText } = render(
      <ConfirmSheet {...props} onConfirm={onConfirm} />,
    );

    fireEvent.press(getByLabelText('nuke my data'));
    expect(onConfirm).toHaveBeenCalled();
    expect(queryByLabelText('nuking')).toBeNull();
  });
});
