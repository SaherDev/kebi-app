import {
  AgentChatResponse,
  AgentResponseData,
  ChatEntity,
  ChatResponseSchema,
  ErrorChatResponse,
  ReasoningStep,
} from './chat';

// An `agent` turn that named one place (shape per docs/api-contract.md → POST
// /v1/chat): prose with a `kebi://` link plus the entity resolving it.
const AGENT_FIXTURE = {
  type: 'agent',
  message: 'tonight is [Luigis](kebi://venue/c0ffee00) night',
  data: {
    reasoning_steps: [
      { step: 'find_saved.summary', title: 'searched your saved spots', summary: '2 spots' },
    ],
    entities: [
      {
        kind: 'venue',
        key: 'c0ffee00',
        name: 'Luigis',
        uri: 'kebi://venue/c0ffee00',
        icon: '🍕',
      },
      {
        kind: 'area',
        key: 'id/badung/canggu',
        name: 'Canggu',
        uri: 'kebi://area/id/badung/canggu',
      },
    ],
    recommendation_id: 'rec_1',
  },
  tool_calls_used: 1,
};

const ERROR_FIXTURE = {
  type: 'error',
  message: 'Something went wrong, try again',
  data: { detail: 'upstream timeout' },
  tool_calls_used: 0,
};

describe('ChatResponseSchema', () => {
  it('parses an agent turn into class instances all the way down', () => {
    const res = ChatResponseSchema.parse(AGENT_FIXTURE);

    expect(res).toBeInstanceOf(AgentChatResponse);
    expect(res.type).toBe('agent');
    const data = (res as AgentChatResponse).data;
    expect(data).toBeInstanceOf(AgentResponseData);
    expect(data?.reasoning_steps[0]).toBeInstanceOf(ReasoningStep);

    expect(data?.recommendation_id).toBe('rec_1');
    const entity = data?.entities[0];
    expect(entity).toBeInstanceOf(ChatEntity);
    expect(entity?.uri).toBe('kebi://venue/c0ffee00');
    expect(entity?.icon).toBe('🍕');
    // Nullable on both kinds (ADR-146) — an omitted icon reads as null, not
    // undefined, so the client falls back to its own mapping.
    expect(data?.entities[1].icon).toBeNull();
  });

  it('rejects an entity kind this build cannot open', () => {
    const data = { ...AGENT_FIXTURE.data, entities: [{ kind: 'planet', key: 'x', name: 'X', uri: 'kebi://planet/x' }] };
    expect(() => ChatResponseSchema.parse({ ...AGENT_FIXTURE, data })).toThrow();
  });

  it('parses the error arm into an ErrorChatResponse', () => {
    const res = ChatResponseSchema.parse(ERROR_FIXTURE);

    expect(res).toBeInstanceOf(ErrorChatResponse);
    expect(res.type).toBe('error');
    expect((res as ErrorChatResponse).data?.detail).toBe('upstream timeout');
  });

  it('rejects an unknown top-level type', () => {
    expect(() => ChatResponseSchema.parse({ ...AGENT_FIXTURE, type: 'mystery' })).toThrow();
  });

  it('strips unknown keys rather than rejecting (forward-compat)', () => {
    const res = ChatResponseSchema.parse({ ...AGENT_FIXTURE, future_field: 'ignored' });

    expect(res).toBeInstanceOf(AgentChatResponse);
    expect((res as unknown as Record<string, unknown>).future_field).toBeUndefined();
  });
});
