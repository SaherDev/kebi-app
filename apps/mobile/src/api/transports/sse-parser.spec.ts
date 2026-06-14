import { parseSseFrames } from './sse-parser';
import { SchemaValidationError } from '../validate';
import {
  SseDone,
  SseError,
  SseMessage,
  SseReasoningStep,
  SseToolResult,
} from '../models/sse';

/** Build a `event:/data:` frame (with the trailing blank line) for a payload. */
function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

const ACTIVE = {
  id: 'find_saved#0',
  step: 'find_saved',
  title: 'searched your saved spots',
  summary: null,
  status: 'active',
  source: 'agent',
  visibility: 'user',
  duration_ms: null,
};
const DONE = { ...ACTIVE, step: 'find_saved.summary', summary: '2 spots', status: 'done', duration_ms: 420 };

describe('parseSseFrames', () => {
  it('parses each frame type into its validated model', () => {
    const p = parseSseFrames();
    const events = [
      ...p.push(frame('reasoning_step', ACTIVE)),
      ...p.push(frame('tool_result', { tool: 'find_saved', tool_call_id: 'c1', payload: { candidates: [] } })),
      ...p.push(frame('message', { content: 'here you go' })),
      ...p.push(frame('done', { tool_calls_used: 1 })),
    ];

    expect(events.map((e) => e.type)).toEqual(['reasoning_step', 'tool_result', 'message', 'done']);
    expect(events[0].data).toBeInstanceOf(SseReasoningStep);
    expect(events[1].data).toBeInstanceOf(SseToolResult);
    expect(events[2].data).toBeInstanceOf(SseMessage);
    expect(events[3].data).toBeInstanceOf(SseDone);
  });

  it('upserts a step lifecycle — active then done share the id', () => {
    const p = parseSseFrames();
    const [a] = p.push(frame('reasoning_step', ACTIVE));
    const [d] = p.push(frame('reasoning_step', DONE));
    expect(a.data).toMatchObject({ id: 'find_saved#0', status: 'active', summary: null });
    expect(d.data).toMatchObject({ id: 'find_saved#0', status: 'done', summary: '2 spots' });
  });

  it('reassembles a frame split across two pushes', () => {
    const p = parseSseFrames();
    const whole = frame('message', { content: 'split me' });
    const cut = Math.floor(whole.length / 2);

    expect(p.push(whole.slice(0, cut))).toHaveLength(0); // partial — nothing yet
    const events = p.push(whole.slice(cut));
    expect(events).toHaveLength(1);
    expect((events[0].data as SseMessage).content).toBe('split me');
  });

  it('emits multiple frames delivered in one chunk', () => {
    const p = parseSseFrames();
    const events = p.push(frame('message', { content: 'a' }) + frame('done', { tool_calls_used: 0 }));
    expect(events.map((e) => e.type)).toEqual(['message', 'done']);
  });

  it('concatenates multi-line data and tolerates CRLF', () => {
    const p = parseSseFrames();
    const events = p.push('event: error\r\ndata: {"detail":\r\ndata: "boom"}\r\n\r\n');
    expect(events).toHaveLength(1);
    expect((events[0].data as SseError).detail).toBe('boom');
  });

  it('skips unknown event names', () => {
    const p = parseSseFrames();
    expect(p.push(frame('heartbeat', { t: 1 }))).toHaveLength(0);
  });

  it('flush emits a trailing frame with no closing blank line', () => {
    const p = parseSseFrames();
    expect(p.push(`event: done\ndata: ${JSON.stringify({ tool_calls_used: 2 })}`)).toHaveLength(0);
    const events = p.flush();
    expect(events).toHaveLength(1);
    expect((events[0].data as SseDone).tool_calls_used).toBe(2);
  });

  it('fails closed on malformed payload (schema drift)', () => {
    const p = parseSseFrames();
    expect(() => p.push(frame('done', { tool_calls_used: 'not-a-number' }))).toThrow(
      SchemaValidationError,
    );
  });
});
