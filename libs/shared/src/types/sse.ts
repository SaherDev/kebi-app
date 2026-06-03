export type SseEventType = 'reasoning_step' | 'tool_result' | 'message' | 'done' | 'error';

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
  /** Short third-person action — the bold line. Present on both frames. */
  title: string;
  /** Result detail (the muted line); `null` on the `active` frame, filled on `done`. */
  summary: string | null;
  status: ReasoningStepStatus;
  source?: 'agent' | 'fallback';
  visibility?: 'user' | 'debug';
  duration_ms?: number;
  timestamp?: string;
}

export interface SseToolResult {
  tool: string | null;
  tool_call_id: string | null;
  payload: Record<string, unknown> | null;
}

export interface SseMessage {
  content: string;
}

export interface SseDone {
  tool_calls_used: number;
}

export interface SseError {
  detail: string;
}

export type SseEvent =
  | { type: 'reasoning_step'; data: SseReasoningStep }
  | { type: 'tool_result'; data: SseToolResult }
  | { type: 'message'; data: SseMessage }
  | { type: 'done'; data: SseDone }
  | { type: 'error'; data: SseError };
