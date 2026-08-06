import type { ChatEntity } from '../lib/types.js';

/**
 * Frame names on `POST /v1/chat/stream`. There is no `tool_result` frame (kebi
 * ADR-136) — the stream carries reasoning, then the answer text plus the
 * entities resolving its links; every richer view lives on the detail screen a
 * link opens.
 */
export type SseEventType = 'reasoning_step' | 'message' | 'done' | 'error';

/**
 * Lifecycle marker on a streamed reasoning step (ADR-102). A step is emitted
 * twice, keyed by `id`: `active` when it starts (summary still `null`, render a
 * skeleton) and `done` when it finishes. An interrupted step may stay `active`
 * with no following `done` — it renders as a step left in its skeleton.
 */
export type ReasoningStepStatus = 'active' | 'done';

/**
 * A `reasoning_step` SSE frame (POST /v1/chat/stream). Carries the step-lifecycle
 * fields `id` + `status` and a nullable `summary` (`null` on the `active` frame)
 * on top of the non-stream {@link ReasoningStep} shape. The client upserts by
 * `id` and filters out `visibility:"debug"` frames itself.
 */
export interface SseReasoningStep {
  /** Stable across the `active` + `done` frames of the same step; upsert key. */
  id: string;
  step: string;
  /** Short action — the bold line (ADR-103). Carries the verb; the same string on
   *  both the `active` and `done` frames. The client upserts by `id`. */
  title: string;
  /** Result detail (the muted line); `null` on the `active` frame, filled on `done`. */
  summary: string | null;
  status: ReasoningStepStatus;
  source?: 'agent' | 'fallback';
  visibility?: 'user' | 'debug';
  /** Node latency; `null` on the `active` frame, set on `done` (api-contract.md). */
  duration_ms?: number | null;
  timestamp?: string;
}

/**
 * The single `message` frame, emitted after the graph completes. `content` is
 * the answer text with entity names already wrapped as markdown links to
 * `kebi://{kind}/{key}`; `entities` resolves each of those links, in the order
 * they appear (ADR-136).
 */
export interface SseMessage {
  content: string;
  entities: ChatEntity[];
}

export interface SseDone {
  tool_calls_used: number;
}

export interface SseError {
  detail: string;
}

export type SseEvent =
  | { type: 'reasoning_step'; data: SseReasoningStep }
  | { type: 'message'; data: SseMessage }
  | { type: 'done'; data: SseDone }
  | { type: 'error'; data: SseError };
