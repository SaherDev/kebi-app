import { render, fireEvent, waitFor } from '@testing-library/react-native';
import type { SseEvent } from '@kebi-app/shared';
import { ChatScreen } from './chat-screen';
import { ChatTranscriptProvider } from './chat-transcript-context';
import { ToastProvider } from './toast-context';
import { streamChat } from '../api/chat';
import { deleteUserData } from '../api/user-data';

// A chainable no-op so the ActionSheet's `Gesture.Pan().activeOffsetY()...`
// chain works (same pattern as save-sheet.spec).
const mockChain = (): unknown => new Proxy({}, { get: () => () => mockChain() });
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: (p: { children: unknown }) => p.children,
  GestureDetector: (p: { children: unknown }) => p.children,
  Gesture: { Pan: () => mockChain() },
}));

// streamChat is replaced per test with a scripted frame sequence. The factory
// returns a bare jest.fn() (no out-of-scope refs, per jest's hoist rule); each
// test sets its implementation.
jest.mock('../api/chat', () => ({ streamChat: jest.fn() }));
// Avoid the real api client (createApiClient throws without EXPO_PUBLIC_API_URL).
jest.mock('../api/hooks', () => ({ useApiClient: () => ({}) }));
// The ? help button navigates via the route graph — mock the router surface.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));
jest.mock('../lib/location', () => ({ getDeviceLocation: async () => null }));
// The clear-history server wipe (scope=chat_history) — asserted, never sent.
jest.mock('../api/user-data', () => ({ deleteUserData: jest.fn(async () => undefined) }));

const mockedStreamChat = streamChat as jest.MockedFunction<typeof streamChat>;
const mockedDeleteUserData = deleteUserData as jest.MockedFunction<typeof deleteUserData>;

const frame = (type: SseEvent['type'], data: unknown): SseEvent => ({ type, data } as SseEvent);

function scriptStream(frames: SseEvent[]) {
  mockedStreamChat.mockImplementation(async function* () {
    for (const ev of frames) yield ev;
  });
}

// Like scriptStream, but the stream parks after `before` until release() —
// lets a test assert mid-stream state (skeleton shown / not shown).
function scriptGatedStream(before: SseEvent[], after: SseEvent[]) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  mockedStreamChat.mockImplementation(async function* () {
    for (const ev of before) yield ev;
    await gate;
    for (const ev of after) yield ev;
  });
  return { release };
}

function renderChat(onClose: () => void = () => undefined) {
  const utils = render(
    <ToastProvider>
      <ChatTranscriptProvider>
        <ChatScreen onClose={onClose} />
      </ChatTranscriptProvider>
    </ToastProvider>,
  );
  const input = utils.getByPlaceholderText('tell me what you want...');
  const submit = (text: string) => {
    fireEvent.changeText(input, text);
    fireEvent(input, 'submitEditing');
  };
  return { ...utils, submit };
}

describe('ChatScreen', () => {
  beforeEach(() => {
    mockedStreamChat.mockReset();
    mockedDeleteUserData.mockClear();
    mockPush.mockClear();
  });

  it('renders the user turn, the streamed steps, and the prose answer', async () => {
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
      frame('message', {
        content: 'tonight is [Contact Tokyo](kebi://venue/c0ffee00) night',
        entities: [
          {
            kind: 'venue',
            key: 'c0ffee00',
            name: 'Contact Tokyo',
            uri: 'kebi://venue/c0ffee00',
            icon: '🪩',
          },
        ],
      }),
      frame('done', { tool_calls_used: 1 }),
    ]);

    const { submit, getAllByText, getByText, queryByText } = renderChat();
    submit('drinks tonight');

    expect(getByText('drinks tonight')).toBeTruthy(); // user turn rendered immediately
    // The prose IS the answer (ADR-136) and the entity link renders as its
    // label — never the raw markdown. The name appears twice: once inline in
    // the sentence, once as the rail chip indexing it.
    await waitFor(() => expect(getAllByText('Contact Tokyo')).toHaveLength(2));
    expect(getByText('mentioned')).toBeTruthy(); // the rail's eyebrow
    expect(getByText('🪩')).toBeTruthy(); // kebi's icon, not our fallback
    expect(getByText('searched your saved spots')).toBeTruthy(); // reasoning step
    expect(queryByText(/kebi:\/\//)).toBeNull();
  });

  it('renders the prose answer on a research turn', async () => {
    const { release } = scriptGatedStream(
      [
        frame('reasoning_step', {
          id: 'research#0',
          step: 'research.summary',
          title: 'looked up da nang',
          summary: '1 note',
          status: 'done',
          visibility: 'user',
        }),
      ],
      [
        frame('message', {
          content: 'da nang tips: my khe beach is calm at sunrise',
          entities: [],
        }),
        frame('done', { tool_calls_used: 1 }),
      ],
    );

    const { submit, getByText } = renderChat();
    submit('any tips for da nang?');

    await waitFor(() => expect(getByText('looked up da nang')).toBeTruthy());

    release();
    await waitFor(() =>
      expect(getByText('da nang tips: my khe beach is calm at sunrise')).toBeTruthy(),
    );
  });

  it('shows the agent message when the turn has no places', async () => {
    scriptStream([
      frame('message', { content: 'hey saher, what is the move?', entities: [] }),
      frame('done', { tool_calls_used: 0 }),
    ]);

    const { submit, getByText } = renderChat();
    submit('hey');

    await waitFor(() => expect(getByText('hey saher, what is the move?')).toBeTruthy());
  });

  it('types the thinking out live, then promotes it into the answer', async () => {
    // The trivial-turn shape: one thinking row, no tool steps, no location step
    // — the agent's talk turns out to BE the answer, so it moves.
    const { release } = scriptGatedStream(
      [
        frame('reasoning_step', {
          id: 'agent.tool_decision#0',
          step: 'agent.tool_decision',
          title: 'thinking',
          summary: null,
          status: 'active',
          visibility: 'user',
        }),
        frame('reasoning_delta', { id: 'agent.tool_decision#0', text: 'hey saher' }),
        frame('reasoning_delta', { id: 'agent.tool_decision#0', text: " — that's you" }),
      ],
      [
        frame('message_delta', { text: "hey saher — that's you, ", promote: true }),
        frame('message_delta', { text: 'we have met' }),
        frame('message', { content: "hey saher — that's you, we have met", entities: [] }),
        frame('done', { tool_calls_used: 0 }),
      ],
    );

    const { submit, getByText, queryByText } = renderChat();
    submit('whats my name?');

    // Mid-stream: the thinking is typing into the trace row, not the bubble.
    await waitFor(() => expect(getByText("hey saher — that's you")).toBeTruthy());

    release();

    // Promoted: the same words now live in the answer, and the trace row no
    // longer holds the typed text (its own summary fills in later).
    await waitFor(() => expect(getByText("hey saher — that's you, we have met")).toBeTruthy());
    expect(queryByText("hey saher — that's you")).toBeNull();
  });

  it('streams the answer as plain prose, then the final frame links the names', async () => {
    const { release } = scriptGatedStream(
      [
        frame('message_delta', { text: 'tonight, ' }),
        frame('message_delta', { text: 'go to Contact Tokyo' }),
      ],
      [
        frame('message', {
          content: 'tonight, go to [Contact Tokyo](kebi://venue/c0ffee00)',
          entities: [
            {
              kind: 'venue',
              key: 'c0ffee00',
              name: 'Contact Tokyo',
              uri: 'kebi://venue/c0ffee00',
              icon: '🪩',
            },
          ],
        }),
        frame('done', { tool_calls_used: 1 }),
      ],
    );

    const { submit, getByText, getAllByText, queryByText } = renderChat();
    submit('drinks tonight');

    // Streaming: one accumulated run of prose, no links yet.
    await waitFor(() => expect(getByText('tonight, go to Contact Tokyo')).toBeTruthy());

    release();

    // The final frame replaced it wholesale: same words, now tappable (inline +
    // the rail chip) — and never the raw markdown.
    await waitFor(() => expect(getAllByText('Contact Tokyo')).toHaveLength(2));
    expect(getByText(/tonight, go to/)).toBeTruthy(); // the prose around the link
    expect(queryByText(/kebi:\/\//)).toBeNull();
  });

  it('interleaves typed prose with work chips, and never doubles the talk', async () => {
    const talk = (id: string, status: 'active' | 'done', summary: string | null) =>
      frame('reasoning_step', {
        id,
        step: 'agent.tool_decision',
        title: 'thinking',
        summary,
        status,
        visibility: 'user',
      });

    const { release } = scriptGatedStream(
      [
        talk('agent.tool_decision#0', 'active', null),
        frame('reasoning_delta', { id: 'agent.tool_decision#0', text: 'canggu on a tuesday — ' }),
        frame('reasoning_delta', { id: 'agent.tool_decision#0', text: 'let me look' }),
        // The talk settles; its summary must NOT also appear as a chip row.
        talk('agent.tool_decision#0', 'done', 'canggu on a tuesday — let me look'),
        frame('reasoning_step', {
          id: 'find_saved#0',
          step: 'find_saved',
          title: 'searched your saved spots',
          summary: 'nothing matched',
          status: 'done',
          visibility: 'user',
        }),
      ],
      [
        frame('message_delta', { text: 'nothing saved yet, so here is the plan', promote: false }),
        frame('message', { content: 'nothing saved yet, so here is the plan', entities: [] }),
        frame('done', { tool_calls_used: 1 }),
      ],
    );

    const { submit, getByText, getAllByText, queryByText } = renderChat();
    submit('what should i do tonight in canggu?');

    // The talk is prose in the body — not a checklist row, and only once even
    // though its `done` summary repeats the same words.
    await waitFor(() =>
      expect(getAllByText('canggu on a tuesday — let me look')).toHaveLength(1),
    );
    // Work lands as a chip row alongside it.
    expect(getByText('searched your saved spots')).toBeTruthy();
    expect(queryByText('thinking')).toBeNull(); // the talk step's title is never a row

    release();
    await waitFor(() => expect(getByText('nothing saved yet, so here is the plan')).toBeTruthy());
    // The prose that came before it is still there, above the answer.
    expect(getAllByText('canggu on a tuesday — let me look')).toHaveLength(1);
  });

  it('renders a turn that carries no deltas at all, exactly as before', async () => {
    // Old backend / fast path: `message` alone must still render the answer.
    scriptStream([
      frame('message', { content: 'no deltas here', entities: [] }),
      frame('done', { tool_calls_used: 0 }),
    ]);

    const { submit, getByText } = renderChat();
    submit('hey');

    await waitFor(() => expect(getByText('no deltas here')).toBeTruthy());
  });

  it('shows an inline error when the stream emits an error frame', async () => {
    scriptStream([frame('error', { detail: 'agent disabled' })]);

    const { submit, getByText } = renderChat();
    submit('hey');

    await waitFor(() => expect(getByText("couldn't reach kebi — try again")).toBeTruthy());
  });

  it('auto-sends a seed message once on mount', async () => {
    scriptStream([
      frame('message', { content: 'on it', entities: [] }),
      frame('done', { tool_calls_used: 0 }),
    ]);

    const { getByText, rerender } = render(
      <ChatTranscriptProvider>
        <ChatScreen onClose={() => undefined} seed="ramen, no line" />
      </ChatTranscriptProvider>,
    );

    // The seed appears as a user turn and streams a reply without any typing.
    await waitFor(() => expect(getByText('ramen, no line')).toBeTruthy());
    expect(mockedStreamChat).toHaveBeenCalledTimes(1);
    expect(mockedStreamChat.mock.calls[0][1]).toBe('ramen, no line');

    // A re-render with the same seed must not fire a second turn.
    rerender(
      <ChatTranscriptProvider>
        <ChatScreen onClose={() => undefined} seed="ramen, no line" />
      </ChatTranscriptProvider>,
    );
    expect(mockedStreamChat).toHaveBeenCalledTimes(1);
  });

  it('clearing from the ••• empties the chat', async () => {
    scriptStream([frame('message', { content: 'hey saher', entities: [] }), frame('done', { tool_calls_used: 0 })]);
    const { submit, getByText, getByLabelText, queryByText } = renderChat();

    // Both top-bar buttons render even on an empty chat.
    expect(getByLabelText('more')).toBeTruthy();
    expect(getByLabelText('help')).toBeTruthy();
    submit('hey');
    await waitFor(() => expect(getByText('hey saher')).toBeTruthy());

    // Fake timers around the clear so the scheduled server wipe and toast
    // dismissal don't outlive the test (clearing is a synchronous dispatch).
    jest.useFakeTimers();
    fireEvent.press(getByLabelText('more'));
    fireEvent.press(getByText('clear this chat'));

    expect(queryByText('hey saher')).toBeNull();
    expect(queryByText('hey')).toBeNull();
    expect(getByText('chat cleared')).toBeTruthy(); // toast with undo
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('the ? is always available and closes the chat then pushes /help', () => {
    const onClose = jest.fn();
    const { getByLabelText } = renderChat(onClose);

    // Works on an empty chat too — help never hides.
    fireEvent.press(getByLabelText('help'));
    // Chat is an overlay above the router — it must collapse before the push.
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/help');
  });

  it('undo on the cleared toast restores the transcript', async () => {
    scriptStream([frame('message', { content: 'hey saher', entities: [] }), frame('done', { tool_calls_used: 0 })]);
    const { submit, getByText, getByLabelText, queryByText } = renderChat();

    submit('hey');
    await waitFor(() => expect(getByText('hey saher')).toBeTruthy());
    jest.useFakeTimers();
    fireEvent.press(getByLabelText('more'));
    fireEvent.press(getByText('clear this chat'));
    expect(queryByText('hey saher')).toBeNull();

    fireEvent.press(getByLabelText('undo'));
    expect(getByText('hey saher')).toBeTruthy();
    expect(getByText('hey')).toBeTruthy();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('wipes kebi conversation memory once the undo window closes', async () => {
    scriptStream([frame('message', { content: 'hey saher', entities: [] }), frame('done', { tool_calls_used: 0 })]);
    const { submit, getByText, getByLabelText } = renderChat();
    submit('hey');
    await waitFor(() => expect(getByText('hey saher')).toBeTruthy());

    // Fake timers from here so the 5s undo window can be fast-forwarded.
    jest.useFakeTimers();
    fireEvent.press(getByLabelText('more'));
    fireEvent.press(getByText('clear this chat'));
    expect(mockedDeleteUserData).not.toHaveBeenCalled(); // not before the window closes

    jest.advanceTimersByTime(5000);
    expect(mockedDeleteUserData).toHaveBeenCalledWith(expect.anything(), ['chat_history']);
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('undo cancels the server wipe', async () => {
    scriptStream([frame('message', { content: 'hey saher', entities: [] }), frame('done', { tool_calls_used: 0 })]);
    const { submit, getByText, getByLabelText } = renderChat();
    submit('hey');
    await waitFor(() => expect(getByText('hey saher')).toBeTruthy());

    jest.useFakeTimers();
    fireEvent.press(getByLabelText('more'));
    fireEvent.press(getByText('clear this chat'));
    fireEvent.press(getByLabelText('undo'));

    jest.advanceTimersByTime(5000);
    expect(mockedDeleteUserData).not.toHaveBeenCalled();
    jest.clearAllTimers();
    jest.useRealTimers();
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
