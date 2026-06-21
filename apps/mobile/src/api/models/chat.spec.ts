import {
  AgentChatResponse,
  AgentResponseData,
  ChatResponseSchema,
  ConsultCandidate,
  ConsultResult,
  ErrorChatResponse,
  ReasoningStep,
  ToolResult,
} from './chat';
import { PlaceCore } from './place-core';

const PLACE = {
  id: 'c0ffee00-1111-2222-3333-444455556666',
  provider_id: null,
  place_name: 'Nara Eatery',
  place_name_aliases: [],
  categories: ['restaurant'],
  tags: [],
  location: null,
  created_at: null,
  refreshed_at: null,
};

// An `agent` turn that ran one tool (shape per docs/api-contract.md → POST /v1/chat).
const AGENT_FIXTURE = {
  type: 'agent',
  message: 'Here are three places nearby that fit…',
  data: {
    reasoning_steps: [
      { step: 'find_saved.summary', title: 'searched your saved spots', summary: '2 spots' },
    ],
    tool_results: [
      {
        tool: 'find_saved',
        tool_call_id: 'call_1',
        payload: {
          candidates: [{ place: PLACE, source: 'saved', reason: null }],
          recommendation_id: 'rec_1',
        },
      },
    ],
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

    const tool = data?.tool_results[0];
    expect(tool).toBeInstanceOf(ToolResult);
    expect(tool?.payload).toBeInstanceOf(ConsultResult);
    expect(tool?.payload.candidates[0]).toBeInstanceOf(ConsultCandidate);
    expect(tool?.payload.candidates[0].place).toBeInstanceOf(PlaceCore);
    expect(tool?.payload.candidates[0].place.place_name).toBe('Nara Eatery');
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
