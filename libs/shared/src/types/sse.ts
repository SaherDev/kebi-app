import type { ChatEntity } from '../lib/types.js';

/**
 * Frame names on `POST /v1/chat/stream`. There is no `tool_result` frame (kebi
 * ADR-136) — the stream carries reasoning, then the answer text plus the
 * entities resolving its links; every richer view lives on the detail screen a
 * link opens.
 */
export type SseEventType =
  | 'reasoning_step'
  | 'reasoning_delta'
  | 'message'
  | 'message_delta'
  | 'done'
  | 'error';

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
 * The step kebi uses for the agent's own talk — the sentences it says while it
 * works, as opposed to a tool it ran. These are the ONLY steps that carry
 * {@link SseReasoningDelta} text, and they are rendered as message prose, not as
 * rows in the work chip: their `summary` repeats what already streamed as prose,
 * so drawing both would print the same sentence twice.
 */
export const AGENT_TALK_STEP = 'agent.tool_decision';

/**
 * Is this step the agent talking (prose) rather than work it did (a chip row)?
 *
 * Matches on `id` as well as `step` because `id` is the one field guaranteed
 * stable across a step's `active` and `done` frames, while `step` picks up
 * suffixes on the done frame (`find_saved` → `find_saved.summary`).
 */
export function isAgentTalkStep(step: { id?: string; step: string }): boolean {
  return step.step === AGENT_TALK_STEP || (step.id?.startsWith(`${AGENT_TALK_STEP}#`) ?? false);
}

/**
 * A `reasoning_delta` frame — the agent's thinking typing out live into a step
 * that is already on screen (kebi ADR-157). `id` always matches a
 * `reasoning_step` frame already received with `status:"active"`; the client
 * appends `text` to that row's narration as it arrives, in place of the shimmer
 * skeleton. Raw model text: render as-is, never linkify or transform it.
 *
 * The row's later `done` frame (same `id`) SUPERSEDES the typed text — replace
 * the narration with its `summary`. Deltas are never required: a turn may carry
 * none at all (fast paths, errors) and must still render from `reasoning_step`
 * frames alone.
 */
export interface SseReasoningDelta {
  /** The `SseReasoningStep.id` this text belongs to (already `active` on screen). */
  id: string;
  /** Fragment to APPEND to that row's narration — not the whole narration. */
  text: string;
}

/**
 * A `message_delta` frame — the answer typing itself into the bubble (kebi
 * ADR-158). Plain prose, already voice-normalized: no markdown, no `kebi://`
 * links. Links only ever arrive on the final {@link SseMessage} frame, so a
 * stream that dies mid-answer can never leave a half-written link.
 */
export interface SseMessageDelta {
  /** APPEND to the answer, or SEED it wholesale when `promote` is set. */
  text: string;
  /**
   * Set on the FIRST answer delta of a message whose text had been typing into
   * a thinking row (kebi ADR-159). On promote: clear that row's typed narration
   * (the row stays — its `done` frame fills the summary) and seed the answer
   * bubble with this delta's `text`, which is the full prefix. Nothing the user
   * already read is lost; it moves from the trace into the answer.
   */
  promote?: boolean;
}

/**
 * The single `message` frame, emitted after the graph completes. `content` is
 * the answer text with entity names already wrapped as markdown links to
 * `kebi://{kind}/{key}`; `entities` resolves each of those links, in the order
 * they appear (ADR-136).
 *
 * It is AUTHORITATIVE over anything {@link SseMessageDelta} streamed: replace
 * the whole answer with `content`, never diff or append. The words match what
 * streamed — only the links are new.
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
  | { type: 'reasoning_delta'; data: SseReasoningDelta }
  | { type: 'message'; data: SseMessage }
  | { type: 'message_delta'; data: SseMessageDelta }
  | { type: 'done'; data: SseDone }
  | { type: 'error'; data: SseError };
