import {
  SseDone,
  SseDoneSchema,
  SseError,
  SseErrorSchema,
  SseReasoningStep,
  SseReasoningStepSchema,
} from './sse';

// Frame payloads per docs/api-contract.md → POST /v1/chat/stream.
describe('SseReasoningStepSchema', () => {
  it('parses an active frame (summary null) into a class instance', () => {
    const frame = SseReasoningStepSchema.parse({
      id: 'find_saved#0',
      step: 'find_saved',
      title: 'searched your saved spots',
      summary: null,
      status: 'active',
      source: 'agent',
      visibility: 'user',
    });

    expect(frame).toBeInstanceOf(SseReasoningStep);
    expect(frame.status).toBe('active');
    expect(frame.summary).toBeNull();
  });

  it('parses a done frame with a filled summary and duration', () => {
    const frame = SseReasoningStepSchema.parse({
      id: 'find_saved#0',
      step: 'find_saved.summary',
      title: 'searched your saved spots',
      summary: '2 spots — Wagyu, Beef Tei',
      status: 'done',
      source: 'agent',
      visibility: 'user',
      duration_ms: 420.0,
    });

    expect(frame.status).toBe('done');
    expect(frame.summary).toBe('2 spots — Wagyu, Beef Tei');
    expect(frame.duration_ms).toBe(420);
  });
});

describe('SseDoneSchema / SseErrorSchema', () => {
  it('parses a done frame', () => {
    const done = SseDoneSchema.parse({ tool_calls_used: 1 });
    expect(done).toBeInstanceOf(SseDone);
    expect(done.tool_calls_used).toBe(1);
  });

  it('parses an error frame', () => {
    const err = SseErrorSchema.parse({ detail: 'boom' });
    expect(err).toBeInstanceOf(SseError);
    expect(err.detail).toBe('boom');
  });
});
