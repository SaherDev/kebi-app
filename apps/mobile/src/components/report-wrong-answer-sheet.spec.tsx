import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ReportWrongAnswerSheet } from './report-wrong-answer-sheet';
import { ToastProvider } from './toast-context';

jest.mock('../lib/haptics', () => ({ triggerHaptic: jest.fn() }));

const mockChain = (): unknown => new Proxy({}, { get: () => () => mockChain() });
jest.mock('react-native-reanimated', () =>
  Object.assign(require('react-native-reanimated/mock'), {
    useAnimatedKeyboard: () => ({ height: { value: 0 } }),
  }),
);
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: (p: { children: unknown }) => p.children,
  GestureDetector: (p: { children: unknown }) => p.children,
  Gesture: { Pan: () => mockChain() },
}));

const exchange = { you: 'quiet cafe to work from', kebi: 'Streamer Coffee — big tables' };

function renderSheet(onSubmit = jest.fn(async () => undefined)) {
  const utils = render(
    <ToastProvider>
      <ReportWrongAnswerSheet
        open
        onClose={jest.fn()}
        onSubmit={onSubmit}
        exchange={exchange}
      />
    </ToastProvider>,
  );
  return { ...utils, onSubmit };
}

describe('ReportWrongAnswerSheet', () => {
  it('quotes the reported exchange and shows the attach disclosure', () => {
    const { getByText } = renderSheet();

    expect(getByText('quiet cafe to work from')).toBeTruthy();
    expect(getByText('Streamer Coffee — big tables')).toBeTruthy();
    expect(getByText('this report includes the conversation', { exact: false })).toBeTruthy();
  });

  it('typed text alone enables send and submits category + text', async () => {
    const { getByLabelText, getByText, getByPlaceholderText, onSubmit } = renderSheet();

    expect(getByLabelText('send it').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.changeText(getByPlaceholderText('i wanted...'), 'somewhere actually quiet');
    fireEvent.press(getByText("didn't get me"));
    fireEvent.press(getByLabelText('send it'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      category: 'didnt_get_me',
      text: 'somewhere actually quiet',
    });
  });

  it('tapping a selected chip deselects it (send disables again)', () => {
    const { getByLabelText, getByText } = renderSheet();

    fireEvent.press(getByText('missing info'));
    expect(getByLabelText('send it').props.accessibilityState).toMatchObject({ disabled: false });
    fireEvent.press(getByText('missing info'));
    expect(getByLabelText('send it').props.accessibilityState).toMatchObject({ disabled: true });
  });
});
