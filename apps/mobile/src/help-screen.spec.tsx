import { render, fireEvent, waitFor } from '@testing-library/react-native';
import HelpScreen from './app/help';
import { ChatTranscriptProvider } from './components/chat-transcript-context';
import { ToastProvider } from './components/toast-context';
import { sendFeedback } from './api/feedback';

// Lives in src/ (not src/app/) so expo-router's require.context doesn't bundle
// the test. jest.mock factories may only reference `mock`-prefixed variables.
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
}));

jest.mock('./api/hooks', () => ({ useApiClient: () => ({}) }));
jest.mock('./api/feedback', () => ({ sendFeedback: jest.fn(async () => undefined) }));
jest.mock('./lib/haptics', () => ({ triggerHaptic: jest.fn() }));

// Deterministic device/app metadata for payload assertions.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));
jest.mock('expo-device', () => ({ osVersion: '18.5', modelName: 'iPhone 15 Pro' }));

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

const mockedSendFeedback = sendFeedback as jest.MockedFunction<typeof sendFeedback>;

function renderHelp() {
  return render(
    <ToastProvider>
      <ChatTranscriptProvider>
        <HelpScreen />
      </ChatTranscriptProvider>
    </ToastProvider>,
  );
}

describe('HelpScreen', () => {
  beforeEach(() => {
    mockedSendFeedback.mockClear();
    mockedSendFeedback.mockResolvedValue(undefined);
  });

  it('renders the hero, the three rows, and the version footer', () => {
    const { getByText } = renderHelp();

    expect(getByText("what's up?")).toBeTruthy();
    expect(getByText('kebi got it wrong')).toBeTruthy();
    expect(getByText('something broke')).toBeTruthy();
    expect(getByText('message us')).toBeTruthy();
    expect(getByText('kebi v1.0.0')).toBeTruthy();
  });

  it('report sheet with no chat: no quote, empty-attach note, chip alone enables send', async () => {
    const { getByText, getByLabelText, queryByText } = renderHelp();

    fireEvent.press(getByLabelText('kebi got it wrong'));
    expect(getByText('what did you expect?')).toBeTruthy();
    // No conversation this session — nothing quoted, nothing attached.
    expect(queryByText('this report includes the conversation', { exact: false })).toBeNull();
    expect(getByText('no recent conversation to attach', { exact: false })).toBeTruthy();

    expect(getByLabelText('send it').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(getByText('wrong place'));
    expect(getByLabelText('send it').props.accessibilityState).toMatchObject({ disabled: false });

    fireEvent.press(getByLabelText('send it'));
    await waitFor(() => expect(mockedSendFeedback).toHaveBeenCalledTimes(1));
    expect(mockedSendFeedback.mock.calls[0][1]).toEqual({
      kind: 'wrong_answer',
      category: 'wrong_place',
      text: undefined,
      exchange: undefined,
      transcript: undefined,
      app_version: '1.0.0',
      platform: 'ios',
      os_version: '18.5',
      device: 'iPhone 15 Pro',
    });

    // Sent: sheet dismisses (title gone) and the confirmation toast shows.
    await waitFor(() => expect(getByText('sent. this is how kebi gets better')).toBeTruthy());
  });

  it('save-went-wrong sheet sends kind extraction with the pasted input', async () => {
    const { getByText, getByLabelText, getByPlaceholderText } = renderHelp();

    fireEvent.press(getByLabelText('a save went wrong'));
    expect(getByText('what happened?')).toBeTruthy();

    fireEvent.changeText(
      getByPlaceholderText('paste the link or what you typed...'),
      'https://www.tiktok.com/@tokyo/video/123',
    );
    // Input alone doesn't enable send — the "what happened" text is required.
    expect(getByLabelText('send it').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.changeText(
      getByPlaceholderText('i shared a tiktok link and...'),
      'saved a ramen place, the video was a cocktail bar',
    );
    fireEvent.press(getByLabelText('send it'));

    await waitFor(() => expect(mockedSendFeedback).toHaveBeenCalledTimes(1));
    expect(mockedSendFeedback.mock.calls[0][1]).toEqual({
      kind: 'extraction',
      text: 'saved a ramen place, the video was a cocktail bar',
      input: 'https://www.tiktok.com/@tokyo/video/123',
      app_version: '1.0.0',
      platform: 'ios',
      os_version: '18.5',
      device: 'iPhone 15 Pro',
    });
  });

  it('bug sheet needs text and stamps app + device metadata', async () => {
    const { getByText, getByLabelText, getByPlaceholderText } = renderHelp();

    fireEvent.press(getByLabelText('something broke'));
    expect(getByText('what happened?')).toBeTruthy();
    expect(getByLabelText('send it').props.accessibilityState).toMatchObject({ disabled: true });

    fireEvent.changeText(getByPlaceholderText('it crashed when...'), 'save sheet froze');
    fireEvent.press(getByLabelText('send it'));

    await waitFor(() => expect(mockedSendFeedback).toHaveBeenCalledTimes(1));
    expect(mockedSendFeedback.mock.calls[0][1]).toEqual({
      kind: 'bug',
      text: 'save sheet froze',
      app_version: '1.0.0',
      platform: 'ios',
      os_version: '18.5',
      device: 'iPhone 15 Pro',
    });
  });

  it('a failed send keeps the sheet open with an error toast', async () => {
    mockedSendFeedback.mockRejectedValueOnce(new Error('network down'));
    const { getByText, getByLabelText, getByPlaceholderText } = renderHelp();

    fireEvent.press(getByLabelText('message us'));
    fireEvent.changeText(
      getByPlaceholderText('a question, an idea, anything else...'),
      'love the app',
    );
    fireEvent.press(getByLabelText('send it'));

    await waitFor(() => expect(getByText("couldn't send — try again")).toBeTruthy());
    // Sheet still open, draft intact for a retry.
    expect(getByText("what's on your mind?")).toBeTruthy();
    expect(getByPlaceholderText('a question, an idea, anything else...').props.value).toBe(
      'love the app',
    );
  });
});
