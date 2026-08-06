import { z } from 'zod';
import type {
  AgentResponseData as AgentResponseDataContract,
  ChatEntity as ChatEntityContract,
  ChatEntityKind,
  ChatResponse as ChatResponseContract,
  ErrorResponseData as ErrorResponseDataContract,
  ReasoningStep as ReasoningStepContract,
} from '@kebi-app/shared';

/**
 * Runtime models for the non-stream `POST /v1/chat` response (api-contract.md).
 * Same class+schema pattern as ./place-core: each class `implements` its
 * `@kebi-app/shared` interface and the paired `*Schema` `.transform()`s into it,
 * so a validated `ChatResponse` carries class instances all the way down
 * (ChatResponse → AgentResponseData → ReasoningStep / ChatEntity). Tool
 * payloads are not part of the response (ADR-136).
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

// ── ChatEntity ───────────────────────────────────────────────────────────────
// One per `kebi://` link in the answer text (ADR-136). `kind` is a strict
// literal union — an unknown kind is a link this build cannot open, so it must
// fail validation rather than reach the link handler. `icon` is the emoji drawn
// beside the name (ADR-146), nullable on both kinds.

export class ChatEntity implements ChatEntityContract {
  readonly kind: ChatEntityKind;
  readonly key: string;
  readonly name: string;
  readonly uri: string;
  readonly icon: string | null;

  constructor(p: ChatEntityContract) {
    this.kind = p.kind;
    this.key = p.key;
    this.name = p.name;
    this.uri = p.uri;
    this.icon = p.icon;
  }
}

export const ChatEntitySchema = z
  .object({
    kind: z.enum(['venue', 'area']),
    key: z.string(),
    name: z.string(),
    uri: z.string(),
    // Nullable on both kinds (ADR-146); absent on a pre-ADR-146 payload.
    icon: z.string().nullable().default(null),
  })
  .transform((p) => new ChatEntity(p));

// ── Response data arms ───────────────────────────────────────────────────────

export class AgentResponseData implements AgentResponseDataContract {
  readonly reasoning_steps: ReasoningStepContract[];
  readonly entities: ChatEntityContract[];
  readonly recommendation_id: string | null;

  constructor(p: AgentResponseDataContract) {
    this.reasoning_steps = p.reasoning_steps;
    this.entities = p.entities;
    this.recommendation_id = p.recommendation_id;
  }
}

export const AgentResponseDataSchema = z
  .object({
    reasoning_steps: z.array(ReasoningStepSchema),
    entities: z.array(ChatEntitySchema),
    recommendation_id: z.string().nullable(),
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
