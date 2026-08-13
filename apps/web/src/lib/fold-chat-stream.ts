import {
  isAgentTalkStep,
  type ChatEntity,
  type SseEvent,
  type SseReasoningStep,
} from '@kebi-app/shared';

/**
 * Folds a turn's SSE frames into the shape the transcript draws (ADR-055): the
 * agent's own sentences as message prose, the tools it ran as collapsible work
 * chips between them, in stream order.
 *
 * ```
 * ● thought for 2s ▸        ← a `work` segment
 * gili t for the weekend…   ← a `prose` segment (the agent talking)
 * ```
 *
 * Pure and event-log-shaped, because that is how the web store holds a turn: it
 * appends frames and re-derives. Mobile runs the same rules incrementally in its
 * reducer instead — it re-renders per token, so it has to preserve the identity
 * of segments a frame didn't touch. The rules both follow (what counts as talk,
 * what supersedes what, what `promote` means) live in `@kebi-app/shared`.
 */

export type StreamSegment =
  | { kind: 'prose'; key: string; stepId: string; text: string; promoted?: boolean }
  | { kind: 'work'; key: string; steps: SseReasoningStep[] };

export interface FoldedStream {
  /** Prose the agent said + work it did, interleaved in arrival order. */
  segments: StreamSegment[];
  /** The answer: streamed `message_delta` text, replaced wholesale by `message`. */
  message: string;
  /** Resolves the `kebi://` links in `message` — only ever from the final frame. */
  entities: ChatEntity[];
  /** The turn produced a final `message` frame. */
  hasMessage: boolean;
}

/** Index of the last segment matching `match`, or -1. */
function lastIndex(segments: StreamSegment[], match: (s: StreamSegment) => boolean): number {
  for (let i = segments.length - 1; i >= 0; i -= 1) if (match(segments[i])) return i;
  return -1;
}

export function foldChatStream(events: SseEvent[]): FoldedStream {
  const segments: StreamSegment[] = [];
  let message = '';
  let entities: ChatEntity[] = [];
  let hasMessage = false;

  for (const event of events) {
    switch (event.type) {
      case 'reasoning_step': {
        const step = event.data;
        // Debug frames ride the stream but never render (ADR-102).
        if (step.visibility === 'debug') break;

        if (isAgentTalkStep(step)) {
          // Talk becomes prose, never a chip row: its summary repeats what
          // already streamed as prose, so a row would print it twice.
          const idx = segments.findIndex((s) => s.kind === 'prose' && s.stepId === step.id);
          if (idx === -1) {
            segments.push({ kind: 'prose', key: `seg${segments.length}`, stepId: step.id, text: '' });
            break;
          }
          const prev = segments[idx] as Extract<StreamSegment, { kind: 'prose' }>;
          // The done frame supersedes what typed out — unless those words are
          // now the answer, in which case writing them back would double them.
          if (step.status === 'done' && step.summary !== null && !prev.promoted) {
            segments[idx] = { ...prev, text: step.summary };
          }
          break;
        }

        // Work: grouped into the trailing chip so consecutive tools read as one
        // "thought for 2s"; prose between them closes it and opens the next.
        const owner = lastIndex(
          segments,
          (s) => s.kind === 'work' && s.steps.some((row) => row.id === step.id),
        );
        if (owner !== -1) {
          const chip = segments[owner] as Extract<StreamSegment, { kind: 'work' }>;
          segments[owner] = {
            ...chip,
            steps: chip.steps.map((row) => (row.id === step.id ? step : row)),
          };
          break;
        }
        const last = segments[segments.length - 1];
        if (last?.kind === 'work') {
          segments[segments.length - 1] = { ...last, steps: [...last.steps, step] };
          break;
        }
        segments.push({ kind: 'work', key: `seg${segments.length}`, steps: [step] });
        break;
      }

      case 'reasoning_delta': {
        // The agent talking, live. A delta for a segment that was never opened
        // (a debug step, or one we never saw) is dropped rather than inventing
        // prose the contract didn't announce.
        const idx = segments.findIndex(
          (s) => s.kind === 'prose' && s.stepId === event.data.id,
        );
        if (idx === -1) break;
        const prev = segments[idx] as Extract<StreamSegment, { kind: 'prose' }>;
        segments[idx] = { ...prev, text: prev.text + event.data.text };
        break;
      }

      case 'message_delta': {
        if (!event.data.promote) {
          message += event.data.text;
          break;
        }
        // Promote: the sentence that was typing as prose IS the answer's start.
        // The delta carries the full prefix, so the answer is seeded with it and
        // the segment emptied — same words, same place, nothing moves.
        message = event.data.text;
        const idx = lastIndex(segments, (s) => s.kind === 'prose' && s.text !== '');
        if (idx === -1) break;
        const prev = segments[idx] as Extract<StreamSegment, { kind: 'prose' }>;
        segments[idx] = { ...prev, text: '', promoted: true };
        break;
      }

      case 'message':
        // Authoritative — a wholesale replace of whatever streamed, never a
        // diff or append. Same words; the links are what's new.
        message = event.data.content;
        entities = event.data.entities;
        hasMessage = true;
        break;

      default:
        break;
    }
  }

  return { segments, message, entities, hasMessage };
}
