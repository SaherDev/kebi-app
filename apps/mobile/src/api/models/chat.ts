import { z } from 'zod';
import type {
  AgentResponseData as AgentResponseDataContract,
  ChatResponse as ChatResponseContract,
  ConsultCandidate as ConsultCandidateContract,
  ConsultCandidateSource,
  ConsultEmptyReason,
  ConsultResult as ConsultResultContract,
  ConsultTool,
  ErrorResponseData as ErrorResponseDataContract,
  PlaceCore as PlaceCoreContract,
  ReasoningStep as ReasoningStepContract,
  ToolResult as ToolResultContract,
} from '@kebi-app/shared';
import { PlaceCoreSchema } from './place-core';

/**
 * Runtime models for the non-stream `POST /v1/chat` response (api-contract.md).
 * Same class+schema pattern as ./place-core: each class `implements` its
 * `@kebi-app/shared` interface and the paired `*Schema` `.transform()`s into it,
 * so a validated `ChatResponse` carries class instances all the way down
 * (ChatResponse → ToolResult → ConsultResult → ConsultCandidate → PlaceCore).
 *
 * Strict literal-union fields (`tool`, `source`) use `z.enum`; free-text /
 * `LiteralUnion` fields (`empty_reason`) accept any string for forward-compat
 * (ADR-019).
 */

// ── ReasoningStep ────────────────────────────────────────────────────────────

export class ReasoningStep implements ReasoningStepContract {
  readonly step: string;
  readonly title: string;
  readonly summary: string;
  readonly source?: 'agent' | 'fallback';
  readonly visibility?: 'user' | 'debug';
  readonly duration_ms?: number;
  readonly timestamp?: string;

  constructor(p: ReasoningStepContract) {
    this.step = p.step;
    this.title = p.title;
    this.summary = p.summary;
    if (p.source !== undefined) this.source = p.source;
    if (p.visibility !== undefined) this.visibility = p.visibility;
    if (p.duration_ms !== undefined) this.duration_ms = p.duration_ms;
    if (p.timestamp !== undefined) this.timestamp = p.timestamp;
  }
}

export const ReasoningStepSchema = z
  .object({
    step: z.string(),
    title: z.string(),
    summary: z.string(),
    source: z.enum(['agent', 'fallback']).optional(),
    visibility: z.enum(['user', 'debug']).optional(),
    duration_ms: z.number().optional(),
    timestamp: z.string().optional(),
  })
  .transform((p) => new ReasoningStep(p));

// ── ConsultResult / ConsultCandidate ─────────────────────────────────────────

export class ConsultCandidate implements ConsultCandidateContract {
  readonly place: PlaceCoreContract;
  readonly source: ConsultCandidateSource;
  readonly reason?: string | null;

  constructor(p: ConsultCandidateContract) {
    this.place = p.place;
    this.source = p.source;
    if (p.reason !== undefined) this.reason = p.reason;
  }
}

export const ConsultCandidateSchema = z
  .object({
    place: PlaceCoreSchema,
    source: z.enum(['saved', 'suggested', 'discovered']),
    reason: z.string().nullable().optional(),
  })
  .transform((p) => new ConsultCandidate(p));

export class ConsultResult implements ConsultResultContract {
  readonly candidates: ConsultCandidateContract[];
  readonly empty_reason?: ConsultEmptyReason | null;
  readonly recommendation_id: string;

  constructor(p: ConsultResultContract) {
    this.candidates = p.candidates;
    if (p.empty_reason !== undefined) this.empty_reason = p.empty_reason;
    this.recommendation_id = p.recommendation_id;
  }
}

export const ConsultResultSchema = z
  .object({
    candidates: z.array(ConsultCandidateSchema),
    empty_reason: z.string().nullable().optional(),
    recommendation_id: z.string(),
  })
  .transform((p) => new ConsultResult(p));

// ── ToolResult ───────────────────────────────────────────────────────────────

export class ToolResult implements ToolResultContract {
  readonly tool: ConsultTool;
  readonly tool_call_id: string;
  readonly payload: ConsultResultContract;

  constructor(p: ToolResultContract) {
    this.tool = p.tool;
    this.tool_call_id = p.tool_call_id;
    this.payload = p.payload;
  }
}

export const ToolResultSchema = z
  .object({
    tool: z.enum(['find_saved', 'suggest_places', 'discover_places']),
    tool_call_id: z.string(),
    payload: ConsultResultSchema,
  })
  .transform((p) => new ToolResult(p));

// ── Response data arms ───────────────────────────────────────────────────────

export class AgentResponseData implements AgentResponseDataContract {
  readonly reasoning_steps: ReasoningStepContract[];
  readonly tool_results: ToolResultContract[];

  constructor(p: AgentResponseDataContract) {
    this.reasoning_steps = p.reasoning_steps;
    this.tool_results = p.tool_results;
  }
}

export const AgentResponseDataSchema = z
  .object({
    reasoning_steps: z.array(ReasoningStepSchema),
    tool_results: z.array(ToolResultSchema),
  })
  .transform((p) => new AgentResponseData(p));

export class ErrorResponseData implements ErrorResponseDataContract {
  readonly detail: string;

  constructor(p: ErrorResponseDataContract) {
    this.detail = p.detail;
  }
}

export const ErrorResponseDataSchema = z
  .object({ detail: z.string() })
  .transform((p) => new ErrorResponseData(p));

// ── ChatResponse (discriminated union on `type`) ─────────────────────────────

type AgentResponseContract = Extract<ChatResponseContract, { type: 'agent' }>;
type ErrorResponseContract = Extract<ChatResponseContract, { type: 'error' }>;

export class AgentChatResponse implements AgentResponseContract {
  readonly type = 'agent' as const;
  readonly message: string;
  readonly data: AgentResponseDataContract | null;
  readonly tool_calls_used: number;

  constructor(p: AgentResponseContract) {
    this.message = p.message;
    this.data = p.data;
    this.tool_calls_used = p.tool_calls_used;
  }
}

export class ErrorChatResponse implements ErrorResponseContract {
  readonly type = 'error' as const;
  readonly message: string;
  readonly data: ErrorResponseDataContract | null;
  readonly tool_calls_used: number;

  constructor(p: ErrorResponseContract) {
    this.message = p.message;
    this.data = p.data;
    this.tool_calls_used = p.tool_calls_used;
  }
}

export type ChatResponse = AgentChatResponse | ErrorChatResponse;

// Discriminator must be a plain literal at the object level, so the arms are
// validated as objects (with nested transforms) and instantiated after
// discrimination.
const AgentChatResponseObject = z.object({
  type: z.literal('agent'),
  message: z.string(),
  data: AgentResponseDataSchema.nullable(),
  tool_calls_used: z.number(),
});

const ErrorChatResponseObject = z.object({
  type: z.literal('error'),
  message: z.string(),
  data: ErrorResponseDataSchema.nullable(),
  tool_calls_used: z.number(),
});

export const ChatResponseSchema = z
  .discriminatedUnion('type', [AgentChatResponseObject, ErrorChatResponseObject])
  .transform((d) =>
    d.type === 'agent' ? new AgentChatResponse(d) : new ErrorChatResponse(d)
  );
