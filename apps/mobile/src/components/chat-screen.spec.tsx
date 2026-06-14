import { render, fireEvent, waitFor } from '@testing-library/react-native';
import type { SseEvent } from '@kebi-app/shared';
import { ChatScreen } from './chat-screen';
import { ChatTranscriptProvider } from './chat-transcript-context';
import { streamChat } from '../api/chat';

// streamChat is replaced per test with a scripted frame sequence. The factory
// returns a bare jest.fn() (no out-of-scope refs, per jest's hoist rule); each
// test sets its implementation.
jest.mock('../api/chat', () => ({ streamChat: jest.fn() }));
// Avoid the real api client (createApiClient throws without EXPO_PUBLIC_API_URL).
jest.mock('../api/hooks', () => ({ useApiClient: () => ({}) }));
jest.mock('../lib/location', () => ({ getDeviceLocation: async () => null }));

const mockedStreamChat = streamChat as jest.MockedFunction<typeof streamChat>;

const frame = (type: SseEvent['type'], data: unknown): SseEvent => ({ type, data } as SseEvent);

function scriptStream(frames: SseEvent[]) {
  mockedStreamChat.mockImplementation(async function* () {
    for (const ev of frames) yield ev;
  });
}

function renderChat() {
  const utils = render(
    <ChatTranscriptProvider>
      <ChatScreen onClose={() => undefined} />
    </ChatTranscriptProvider>,
  );
  const input = utils.getByPlaceholderText('tell me what you want...');
  const submit = (text: string) => {
    fireEvent.changeText(input, text);
    fireEvent(input, 'submitEditing');
  };
  return { ...utils, submit };
}

describe('ChatScreen', () => {
  beforeEach(() => mockedStreamChat.mockReset());

  it('renders the user turn, streamed steps, message, and a place skeleton', async () => {
    scriptStream([
      frame('reasoning_step', {
        id: 'find_saved#0',
        step: 'find_saved',
        title: 'searched your saved spots',
        summary: null,
        status: 'active',
        visibility: 'user',
      }),
      frame('reasoning_step', {
        id: 'find_saved#0',
        step: 'find_saved.summary',
        title: 'searched your saved spots',
        summary: '2 spots',
        status: 'done',
        visibility: 'user',
      }),
      frame('tool_result', { tool: 'find_saved', tool_call_id: 'c1', payload: { candidates: [] } }),
      frame('message', { content: 'here are a couple spots' }),
      frame('done', { tool_calls_used: 1 }),
    ]);

    const { submit, getByText, queryByLabelText } = renderChat();
    submit('drinks tonight');

    expect(getByText('drinks tonight')).toBeTruthy(); // user turn rendered immediately
    await waitFor(() => expect(getByText('here are a couple spots')).toBeTruthy());
    expect(getByText('searched your saved spots')).toBeTruthy(); // reasoning step
    // Once the turn is done the loading skeleton is gone (it's a streaming-only
    // placeholder until Task 2 renders real cards) — never a perpetual shimmer.
    expect(queryByLabelText('loading places')).toBeNull();
  });

  it('shows an inline error when the stream emits an error frame', async () => {
    scriptStream([frame('error', { detail: 'agent disabled' })]);

    const { submit, getByText } = renderChat();
    submit('hey');

    await waitFor(() => expect(getByText("couldn't reach kebi — try again")).toBeTruthy());
  });
});
