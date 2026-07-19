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

// A `research` tool_result frame (ADR-050): a ResearchResult payload — notes
// about an area, no place candidates. The turn's answer is the message prose.
const researchFrame = (over: Record<string, unknown> = {}) =>
  frame('tool_result', {
    tool: 'research',
    tool_call_id: 'r1',
    payload: {
      entity_name: 'Da Nang',
      entity_key: 'vn:da-nang',
      notes: [
        {
          id: 'n1',
          text: 'my khe is calm at sunrise',
          tags: [],
          source: 'community',
          confidence: 0.9,
          agree_count: 0,
          disagree_count: 0,
        },
      ],
      empty_reason: null,
      clarification: null,
      ...over,
    },
  });

function renderChat() {
  const utils = render(
    <ToastProvider>
      <ChatTranscriptProvider>
        <ChatScreen onClose={() => undefined} />
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
  });

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

  it('renders the prose answer on a research turn — no card, no skeleton, no no-match line', async () => {
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
        researchFrame(),
      ],
      [
        frame('message', { content: 'da nang tips: my khe beach is calm at sunrise' }),
        frame('done', { tool_calls_used: 1 }),
      ],
    );

    const { submit, getByText, queryByText, queryByLabelText } = renderChat();
    submit('any tips for da nang?');

    // Mid-stream, the research tool_result has landed: no skeleton — the turn
    // will not produce a card, so nothing should promise one.
    await waitFor(() => expect(getByText('looked up da nang')).toBeTruthy());
    expect(queryByLabelText('loading places')).toBeNull();

    release();
    await waitFor(() =>
      expect(getByText('da nang tips: my khe beach is calm at sunrise')).toBeTruthy(),
    );
    expect(queryByText("couldn't find a match")).toBeNull();
    expect(queryByLabelText('loading places')).toBeNull();
  });

  it("renders kebi's prose (not the generic no-match) when research comes back empty", async () => {
    scriptStream([
      researchFrame({ notes: [], empty_reason: 'no_claims', clarification: 'which area?' }),
      frame('message', { content: 'no intel on that yet — want hoi an instead?' }),
      frame('done', { tool_calls_used: 1 }),
    ]);

    const { submit, getByText, queryByText } = renderChat();
    submit('tips for my khe?');

    await waitFor(() =>
      expect(getByText('no intel on that yet — want hoi an instead?')).toBeTruthy(),
    );
    expect(queryByText("couldn't find a match")).toBeNull();
  });

  it('shows the skeleton mid-stream once a consult result carries candidates', async () => {
    const { release } = scriptGatedStream(
      [
        frame('tool_result', {
          tool: 'find_saved',
          tool_call_id: 'c1',
          payload: {
            candidates: [
              {
                place: {
                  id: null,
                  provider_id: null,
                  place_name: 'Fuglen',
                  place_name_aliases: [],
                  categories: ['cafe'],
                  tags: [],
                  location: null,
                  created_at: null,
                  refreshed_at: null,
                },
                source: 'saved',
                reason: null,
              },
            ],
            recommendation_id: 'rec_1',
          },
        }),
      ],
      [frame('done', { tool_calls_used: 1 })],
    );

    const { submit, getByLabelText, getByText, queryByLabelText } = renderChat();
    submit('coffee near me');

    await waitFor(() => expect(getByLabelText('loading places')).toBeTruthy());
    release();
    await waitFor(() => expect(getByText('Fuglen')).toBeTruthy());
    expect(queryByLabelText('loading places')).toBeNull();
  });

  it('keeps the empty-reason line for a consult turn with no candidates and no prose', async () => {
    scriptStream([
      frame('tool_result', {
        tool: 'discover_places',
        tool_call_id: 'c1',
        payload: { candidates: [], empty_reason: 'no_location', recommendation_id: 'rec_1' },
      }),
      frame('done', { tool_calls_used: 1 }),
    ]);

    const { submit, getByText } = renderChat();
    submit('coffee near me');

    await waitFor(() =>
      expect(getByText('turn on location so i can find places near you')).toBeTruthy(),
    );
  });

  it('lets prose carry a candidate-less consult turn when kebi wrote one', async () => {
    scriptStream([
      frame('tool_result', {
        tool: 'discover_places',
        tool_call_id: 'c1',
        payload: { candidates: [], empty_reason: 'no_match', recommendation_id: 'rec_1' },
      }),
      frame('message', { content: 'nothing open nearby right now — try later tonight?' }),
      frame('done', { tool_calls_used: 1 }),
    ]);

    const { submit, getByText, queryByText } = renderChat();
    submit('quiet bar right now');

    await waitFor(() =>
      expect(getByText('nothing open nearby right now — try later tonight?')).toBeTruthy(),
    );
    expect(queryByText("couldn't find a match")).toBeNull();
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

  it('auto-sends a seed message once on mount', async () => {
    scriptStream([
      frame('message', { content: 'on it' }),
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

  it('shows the ••• only once there are turns, and clearing empties the chat', async () => {
    scriptStream([frame('message', { content: 'hey saher' }), frame('done', { tool_calls_used: 0 })]);
    const { submit, getByText, getByLabelText, queryByText, queryByLabelText } = renderChat();

    expect(queryByLabelText('more')).toBeNull(); // empty chat — no overflow
    submit('hey');
    await waitFor(() => expect(getByText('hey saher')).toBeTruthy());

    // Fake timers around the clear so the scheduled server wipe and toast
    // dismissal don't outlive the test (clearing is a synchronous dispatch).
    jest.useFakeTimers();
    fireEvent.press(getByLabelText('more'));
    fireEvent.press(getByText('clear this chat'));

    expect(queryByText('hey saher')).toBeNull();
    expect(queryByText('hey')).toBeNull();
    expect(queryByLabelText('more')).toBeNull(); // ••• hides again
    expect(getByText('chat cleared')).toBeTruthy(); // toast with undo
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('undo on the cleared toast restores the transcript', async () => {
    scriptStream([frame('message', { content: 'hey saher' }), frame('done', { tool_calls_used: 0 })]);
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
    scriptStream([frame('message', { content: 'hey saher' }), frame('done', { tool_calls_used: 0 })]);
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
    scriptStream([frame('message', { content: 'hey saher' }), frame('done', { tool_calls_used: 0 })]);
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
