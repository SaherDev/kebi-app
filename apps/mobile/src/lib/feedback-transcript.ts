import type { FeedbackTranscriptTurn } from '@kebi-app/shared';
import type { ChatTurn } from '../components/chat-transcript-context';

// Caps match the gateway DTO (@MaxLength/@ArrayMaxSize) so a long chat never
// turns into a 400 — the client trims before it sends.
const MAX_TURNS = 20;
const TURN_TEXT_MAX = 500;

function clip(text: string): string {
  return text.length > TURN_TEXT_MAX ? `${text.slice(0, TURN_TEXT_MAX - 1)}…` : text;
}

function toTurn(turn: ChatTurn): FeedbackTranscriptTurn | null {
  const at = new Date(turn.at).toISOString();
  if (turn.role === 'you') {
    return { role: 'you', text: clip(turn.text), at };
  }
  // Work titles only — the agent's talk is prose in `message`/segments, not a
  // step, so it would read as a duplicate line in the report.
  const stepTitles = turn.segments
    .flatMap((segment) => (segment.kind === 'work' ? segment.steps : []))
    .map((s) => s.title)
    .filter((title): title is string => Boolean(title));
  if (!turn.message && stepTitles.length === 0) return null;
  return {
    role: 'kebi',
    text: clip(turn.message),
    at,
    ...(stepTitles.length ? { step_titles: stepTitles } : {}),
  };
}

/**
 * Maps the in-memory chat transcript into the lean report attachment (ADR-051):
 * turn text and reasoning step titles. Tool names are no longer available to
 * the client (kebi ADR-136) — the step titles carry what ran. Newest
 * `MAX_TURNS` turns only; `undefined` when there's nothing to attach.
 */
export function toFeedbackTranscript(turns: ChatTurn[]): FeedbackTranscriptTurn[] | undefined {
  const mapped = turns.map(toTurn).filter((t): t is FeedbackTranscriptTurn => t !== null);
  if (mapped.length === 0) return undefined;
  return mapped.slice(-MAX_TURNS);
}

/**
 * The latest you→kebi pair, quoted at the top of the report sheet so the user
 * sees exactly which exchange they're reporting. `undefined` when the session
 * has no answered turn yet.
 */
export function latestExchange(turns: ChatTurn[]): { you: string; kebi: string } | undefined {
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i];
    if (turn.role !== 'kebi' || !turn.message) continue;
    for (let j = i - 1; j >= 0; j--) {
      const earlier = turns[j];
      if (earlier.role === 'you') {
        return { you: clip(earlier.text), kebi: clip(turn.message) };
      }
    }
    return undefined;
  }
  return undefined;
}
