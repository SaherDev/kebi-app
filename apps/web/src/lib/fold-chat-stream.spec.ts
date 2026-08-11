import type { SseEvent, SseReasoningStep } from '@kebi-app/shared';
import { foldChatStream } from './fold-chat-stream';

/** A work step — a tool the agent ran; a row inside a chip. */
function work(over: Partial<SseReasoningStep> = {}): SseEvent {
  return {
    type: 'reasoning_step',
    data: {
      id: 'find_saved#0',
      step: 'find_saved',
      title: 'searched your saved spots',
      summary: null,
      status: 'active',
      visibility: 'user',
      ...over,
    },
  };
}

/** A talk step — the agent speaking; message prose, never a row. */
function talk(over: Partial<SseReasoningStep> = {}): SseEvent {
  return {
    type: 'reasoning_step',
    data: {
      id: 'agent.tool_decision#0',
      step: 'agent.tool_decision',
      title: 'thinking',
      summary: null,
      status: 'active',
      visibility: 'user',
      ...over,
    },
  };
}

/** The turn's body as the screen draws it, in stream order. */
function shape(events: SseEvent[]): string {
  return foldChatStream(events)
    .segments.map((s) =>
      s.kind === 'prose' ? `prose(${s.text})` : `work[${s.steps.map((r) => r.id).join(' ')}]`,
    )
    .join(' ');
}

describe('foldChatStream', () => {
  it('renders the agent talk as prose, never as a work row', () => {
    const events = [
      talk(),
      { type: 'reasoning_delta', data: { id: 'agent.tool_decision#0', text: 'checking ' } },
      { type: 'reasoning_delta', data: { id: 'agent.tool_decision#0', text: 'your saves' } },
    ] as SseEvent[];
    expect(shape(events)).toBe('prose(checking your saves)');
  });

  it("the talk step's done summary supersedes the text that typed out", () => {
    const events = [
      talk(),
      { type: 'reasoning_delta', data: { id: 'agent.tool_decision#0', text: 'checking ' } },
      talk({ status: 'done', summary: 'checked your saves' }),
    ] as SseEvent[];
    // Never both — drawing the summary as a row too would print it twice.
    expect(shape(events)).toBe('prose(checked your saves)');
  });

  it('interleaves prose and work chips in stream order', () => {
    const events = [
      talk(),
      { type: 'reasoning_delta', data: { id: 'agent.tool_decision#0', text: 'let me look' } },
      work(),
      talk({ id: 'agent.tool_decision#1' }),
    ] as SseEvent[];
    expect(shape(events)).toBe('prose(let me look) work[find_saved#0] prose()');
  });

  it('groups consecutive work into one chip and drops debug frames', () => {
    const events = [
      work(),
      work({ id: 'rank#1', step: 'rank' }),
      work({ id: 'dbg#9', visibility: 'debug' }),
    ] as SseEvent[];
    expect(shape(events)).toBe('work[find_saved#0 rank#1]');
  });

  it("a late done frame updates its own chip's row, not a new chip", () => {
    const events = [
      work(),
      talk({ id: 'agent.tool_decision#1' }),
      work({ status: 'done', summary: 'nothing matched' }),
    ] as SseEvent[];
    expect(shape(events)).toBe('work[find_saved#0] prose()');
    const chip = foldChatStream(events).segments[0];
    expect(chip.kind === 'work' && chip.steps[0].status).toBe('done');
  });

  it('appends message deltas into the answer', () => {
    const events = [
      { type: 'message_delta', data: { text: 'tonight, ' } },
      { type: 'message_delta', data: { text: 'go to Luigis' } },
    ] as SseEvent[];
    expect(foldChatStream(events).message).toBe('tonight, go to Luigis');
  });

  it('promote empties the prose it came from so the words are not doubled', () => {
    const events = [
      talk(),
      { type: 'reasoning_delta', data: { id: 'agent.tool_decision#0', text: 'tonight, ' } },
      { type: 'message_delta', data: { text: 'tonight, ', promote: true } },
      { type: 'message_delta', data: { text: 'go to Luigis' } },
    ] as SseEvent[];
    const folded = foldChatStream(events);
    // Same words, same place — now the answer rather than commentary.
    expect(shape(events)).toBe('prose()');
    expect(folded.message).toBe('tonight, go to Luigis');
  });

  it('a promoted segment ignores its own done summary', () => {
    const events = [
      talk(),
      { type: 'reasoning_delta', data: { id: 'agent.tool_decision#0', text: 'tonight, ' } },
      { type: 'message_delta', data: { text: 'tonight, ', promote: true } },
      talk({ status: 'done', summary: 'tonight, go to Luigis' }),
    ] as SseEvent[];
    expect(shape(events)).toBe('prose()');
  });

  it('the final message frame replaces the streamed text wholesale', () => {
    const events = [
      { type: 'message_delta', data: { text: 'tonight is Luigis' } },
      {
        type: 'message',
        data: {
          content: 'tonight is [Luigis](kebi://venue/c0ffee00)',
          entities: [
            {
              kind: 'venue',
              key: 'c0ffee00',
              name: 'Luigis',
              uri: 'kebi://venue/c0ffee00',
              icon: null,
            },
          ],
        },
      },
    ] as SseEvent[];
    const folded = foldChatStream(events);
    // Not appended to, not diffed — replaced, and only now carrying links.
    expect(folded.message).toBe('tonight is [Luigis](kebi://venue/c0ffee00)');
    expect(folded.entities).toHaveLength(1);
    expect(folded.hasMessage).toBe(true);
  });

  it('renders a turn that carries no deltas at all', () => {
    const events = [
      work({ status: 'done', summary: 'nothing matched' }),
      { type: 'message', data: { content: 'no deltas here', entities: [] } },
    ] as SseEvent[];
    const folded = foldChatStream(events);
    expect(folded.message).toBe('no deltas here');
    expect(shape(events)).toBe('work[find_saved#0]');
  });

  it('keeps what streamed when the turn dies mid-delta', () => {
    const events = [
      talk(),
      { type: 'reasoning_delta', data: { id: 'agent.tool_decision#0', text: 'looking at ' } },
      { type: 'message_delta', data: { text: 'half an ans' } },
    ] as SseEvent[];
    const folded = foldChatStream(events);
    expect(folded.message).toBe('half an ans');
    expect(shape(events)).toBe('prose(looking at )');
    expect(folded.hasMessage).toBe(false);
  });

  it('drops a delta for a segment that was never opened', () => {
    const events = [
      talk(),
      { type: 'reasoning_delta', data: { id: 'ghost#9', text: 'nope' } },
    ] as SseEvent[];
    expect(shape(events)).toBe('prose()');
  });
});
