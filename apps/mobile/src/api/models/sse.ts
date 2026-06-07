import { z } from 'zod';
import type {
  ReasoningStepStatus,
  SseDone as SseDoneContract,
  SseError as SseErrorContract,
  SseMessage as SseMessageContract,
  SseReasoningStep as SseReasoningStepContract,
  SseToolResult as SseToolResultContract,
} from '@kebi-app/shared';

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
  readonly duration_ms?: number;
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
    duration_ms: z.number().optional(),
    timestamp: z.string().optional(),
  })
  .transform((p) => new SseReasoningStep(p));

export class SseToolResult implements SseToolResultContract {
  readonly tool: string | null;
  readonly tool_call_id: string | null;
  readonly payload: Record<string, unknown> | null;

  constructor(p: SseToolResultContract) {
    this.tool = p.tool;
    this.tool_call_id = p.tool_call_id;
    this.payload = p.payload;
  }
}

export const SseToolResultSchema = z
  .object({
    tool: z.string().nullable(),
    tool_call_id: z.string().nullable(),
    payload: z.record(z.string(), z.unknown()).nullable(),
  })
  .transform((p) => new SseToolResult(p));

export class SseMessage implements SseMessageContract {
  readonly content: string;

  constructor(p: SseMessageContract) {
    this.content = p.content;
  }
}

export const SseMessageSchema = z
  .object({ content: z.string() })
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
