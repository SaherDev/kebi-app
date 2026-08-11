import type { SseEvent } from '@kebi-app/shared';

/**
 * A real turn, captured verbatim off the local kebi backend on 2026-08-11 —
 * "what should i do tonight in canggu?" through the gateway (`POST
 * /api/v1/chat`). Trimmed only in the length of the answer deltas.
 *
 * Kept as a fixture because this ordering is what the layout has to survive,
 * and three details in it are easy to get wrong from the spec alone:
 *
 * 1. **`step` mutates on the done frame** (`find_known` → `find_known.summary`)
 *    while `id` stays put — so talk/work must be classified by `id`.
 * 2. **The location steps are `debug`**, so they never reach the transcript.
 * 3. **The second talk step's `done` arrives AFTER `promote`**, carrying the
 *    summary "putting the answer together". Rendered, that is a stray line of
 *    commentary sitting between the work and the answer; it must be dropped
 *    because those words were already promoted.
 */
export const CAPTURED_CANGGU_TURN: SseEvent[] = [
  {
    type: 'reasoning_step',
    data: {
      id: 'agent.location#0',
      step: 'agent.location',
      title: 'checking your location',
      summary: null,
      status: 'active',
      visibility: 'debug',
      duration_ms: null,
    },
  },
  {
    type: 'reasoning_step',
    data: {
      id: 'agent.location#0',
      step: 'agent.location_resolved',
      title: 'found your location',
      summary: 'around Canggu, Bali, Indonesia',
      status: 'done',
      visibility: 'debug',
      duration_ms: 2915.97,
    },
  },
  {
    type: 'reasoning_step',
    data: {
      id: 'agent.tool_decision#0',
      step: 'agent.tool_decision',
      title: 'thinking',
      summary: null,
      status: 'active',
      visibility: 'user',
      duration_ms: null,
    },
  },
  { type: 'reasoning_delta', data: { id: 'agent.tool_decision#0', text: "let me see what's good" } },
  {
    type: 'reasoning_delta',
    data: { id: 'agent.tool_decision#0', text: ' for a tuesday night in canggu' },
  },
  {
    type: 'reasoning_step',
    data: {
      id: 'agent.tool_decision#0',
      step: 'agent.tool_decision',
      title: 'thinking',
      summary: "let me see what's good for a tuesday night in canggu",
      status: 'done',
      visibility: 'user',
      duration_ms: 1567.79,
    },
  },
  {
    type: 'reasoning_step',
    data: {
      id: 'find_known#0',
      step: 'find_known',
      title: 'checked what I know around here',
      summary: null,
      status: 'active',
      visibility: 'user',
      duration_ms: null,
    },
  },
  {
    type: 'reasoning_step',
    data: {
      id: 'find_known#0',
      step: 'find_known.summary',
      title: 'checked what I know around here',
      summary: '5 spots — Motel Mexicola | Canggu, Miss Fish Bali, +3 more',
      status: 'done',
      visibility: 'user',
      duration_ms: 30.64,
    },
  },
  {
    type: 'reasoning_step',
    data: {
      id: 'agent.tool_decision#1',
      step: 'agent.tool_decision',
      title: 'sizing it up',
      summary: null,
      status: 'active',
      visibility: 'user',
      duration_ms: null,
    },
  },
  {
    type: 'reasoning_delta',
    data: { id: 'agent.tool_decision#1', text: 'tuesday night in canggu is actually pretty solid.' },
  },
  {
    type: 'reasoning_delta',
    data: { id: 'agent.tool_decision#1', text: ' motel mexicola is the move tonight.' },
  },
  {
    type: 'message_delta',
    data: {
      text: 'tuesday night in canggu is actually pretty solid. motel mexicola is the move tonight.',
      promote: true,
    },
  },
  { type: 'message_delta', data: { text: ' get there before it fills up.' } },
  {
    type: 'reasoning_step',
    data: {
      id: 'agent.tool_decision#1',
      step: 'agent.tool_decision',
      title: 'sizing it up',
      summary: 'putting the answer together',
      status: 'done',
      visibility: 'user',
      duration_ms: 2951.47,
    },
  },
  {
    type: 'message',
    data: {
      content:
        'tuesday night in [canggu](kebi://area/aWQvYmFsaS9jYW5nZ3U) is actually pretty solid. [motel mexicola](kebi://venue/abc123) is the move tonight. get there before it fills up.',
      entities: [
        {
          kind: 'area',
          key: 'id/bali/canggu',
          name: 'canggu',
          uri: 'kebi://area/aWQvYmFsaS9jYW5nZ3U',
          icon: '🏄',
        },
        {
          kind: 'venue',
          key: 'abc123',
          name: 'motel mexicola',
          uri: 'kebi://venue/abc123',
          icon: '🍹',
        },
      ],
    },
  },
  { type: 'done', data: { tool_calls_used: 1 } },
];
