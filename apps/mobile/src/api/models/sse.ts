import { z } from 'zod';
import type {
  ChatEntity as ChatEntityContract,
  ReasoningStepStatus,
  SseDone as SseDoneContract,
  SseError as SseErrorContract,
  SseMessage as SseMessageContract,
  SseMessageDelta as SseMessageDeltaContract,
  SseReasoningDelta as SseReasoningDeltaContract,
  SseReasoningStep as SseReasoningStepContract,
} from '@kebi-app/shared';
import { ChatEntitiesSchema } from './chat';

/**
 * Runtime models for the `POST /v1/chat/stream` SSE frame payloads
 * (api-contract.md → Step lifecycle; mirrors libs/shared/src/types/sse.ts).
 * Each frame's `data` is validated independently by event name. On the stream a
 * step is emitted twice keyed by `id`: an `active` frame (`summary: null`) and a
 * `done` frame (`summary` filled). Same class+schema pattern as ./place-core.
 */

export class SseReasoningStep implements SseReasoningStepContract {
  readonly id: string;
  readonly step: string;
  readonly title: string;
  readonly summary: string | null;
  readonly status: ReasoningStepStatus;
  readonly source?: 'agent' | 'fallback';
  readonly visibility?: 'user' | 'debug';
  readonly duration_ms?: number | null;
  readonly timestamp?: string;

  constructor(p: SseReasoningStepContract) {
    this.id = p.id;
    this.step = p.step;
    this.title = p.title;
    this.summary = p.summary;
    this.status = p.status;
    if (p.source !== undefined) this.source = p.source;
    if (p.visibility !== undefined) this.visibility = p.visibility;
    if (p.duration_ms !== undefined) this.duration_ms = p.duration_ms;
    if (p.timestamp !== undefined) this.timestamp = p.timestamp;
  }
}

export const SseReasoningStepSchema = z
  .object({
    id: z.string(),
    step: z.string(),
    title: z.string(),
    summary: z.string().nullable(),
    status: z.enum(['active', 'done']),
    source: z.enum(['agent', 'fallback']).optional(),
    visibility: z.enum(['user', 'debug']).optional(),
    // `null` on the active frame, a number on done — accept both (api-contract.md).
    duration_ms: z.number().nullable().optional(),
    timestamp: z.string().optional(),
  })
  .transform((p) => new SseReasoningStep(p));

/**
 * A `reasoning_delta` frame: a fragment of the agent's thinking, appended to the
 * `active` row already on screen with the same `id`. The row's later `done`
 * frame supersedes whatever typed out here.
 */
export class SseReasoningDelta implements SseReasoningDeltaContract {
  readonly id: string;
  readonly text: string;

  constructor(p: SseReasoningDeltaContract) {
    this.id = p.id;
    this.text = p.text;
  }
}

export const SseReasoningDeltaSchema = z
  .object({ id: z.string(), text: z.string() })
  .transform((p) => new SseReasoningDelta(p));

/**
 * A `message_delta` frame: a fragment of the answer. `promote` marks the first
 * delta of an answer that had been typing into a thinking row — it carries the
 * full prefix, so the client seeds the bubble with it rather than appending.
 * Plain prose only: never linkified client-side, and never markdown.
 */
export class SseMessageDelta implements SseMessageDeltaContract {
  readonly text: string;
  readonly promote?: boolean;

  constructor(p: SseMessageDeltaContract) {
    this.text = p.text;
    if (p.promote !== undefined) this.promote = p.promote;
  }
}

export const SseMessageDeltaSchema = z
  .object({ text: z.string(), promote: z.boolean().optional() })
  .transform((p) => new SseMessageDelta(p));

/**
 * The final `message` frame. `content` already carries the answer's entity
 * names as markdown links to `kebi://{kind}/{key}`; `entities` resolves each
 * link (ADR-136), in the order they appear.
 */
export class SseMessage implements SseMessageContract {
  readonly content: string;
  readonly entities: ChatEntityContract[];

  constructor(p: SseMessageContract) {
    this.content = p.content;
    this.entities = p.entities;
  }
}

export const SseMessageSchema = z
  .object({ content: z.string(), entities: ChatEntitiesSchema })
  .transform((p) => new SseMessage(p));

export class SseDone implements SseDoneContract {
  readonly tool_calls_used: number;

  constructor(p: SseDoneContract) {
    this.tool_calls_used = p.tool_calls_used;
  }
}

export const SseDoneSchema = z
  .object({ tool_calls_used: z.number() })
  .transform((p) => new SseDone(p));

export class SseError implements SseErrorContract {
  readonly detail: string;

  constructor(p: SseErrorContract) {
    this.detail = p.detail;
  }
}

export const SseErrorSchema = z
  .object({ detail: z.string() })
  .transform((p) => new SseError(p));
