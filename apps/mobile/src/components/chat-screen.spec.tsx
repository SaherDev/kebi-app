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
      frame('tool_result', {
        tool: 'find_saved',
        tool_call_id: 'c1',
        payload: {
          candidates: [
            {
              place: {
                id: null,
                provider_id: null,
                place_name: 'Contact Tokyo',
                place_name_aliases: [],
                categories: ['bar'],
                tags: [],
                location: null,
                created_at: null,
                refreshed_at: null,
              },
              source: 'discovered',
              reason: null,
            },
          ],
          recommendation_id: 'rec_1',
        },
      }),
      frame('message', { content: 'here are a couple spots' }),
      frame('done', { tool_calls_used: 1 }),
    ]);

    const { submit, getByText, queryByText, queryByLabelText } = renderChat();
    submit('drinks tonight');

    expect(getByText('drinks tonight')).toBeTruthy(); // user turn rendered immediately
    await waitFor(() => expect(getByText('Contact Tokyo')).toBeTruthy()); // real card
    expect(getByText('searched your saved spots')).toBeTruthy(); // reasoning step
    expect(queryByLabelText('loading places')).toBeNull(); // skeleton gone once done
    // The prose message is hidden when the turn has cards (cards are the answer).
    expect(queryByText('here are a couple spots')).toBeNull();
  });

  it('shows the agent message when the turn has no places', async () => {
    scriptStream([
      frame('message', { content: 'hey saher, what is the move?' }),
      frame('done', { tool_calls_used: 0 }),
    ]);

    const { submit, getByText } = renderChat();
    submit('hey');

    await waitFor(() => expect(getByText('hey saher, what is the move?')).toBeTruthy());
  });

  it('shows an inline error when the stream emits an error frame', async () => {
    scriptStream([frame('error', { detail: 'agent disabled' })]);

    const { submit, getByText } = renderChat();
    submit('hey');

    await waitFor(() => expect(getByText("couldn't reach kebi — try again")).toBeTruthy());
  });

  it('shows the rate-limit message when the gateway returns 429', async () => {
    mockedStreamChat.mockImplementation(
      // eslint-disable-next-line require-yield
      async function* () {
        throw Object.assign(new Error('rate_limit_exceeded'), { status: 429 });
      },
    );

    const { submit, getByText } = renderChat();
    submit('is japan good places?');

    await waitFor(() => expect(getByText('too many asks — give it a sec')).toBeTruthy());
  });
});
