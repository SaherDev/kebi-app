import type { FeedbackSaveAttempt } from '@kebi-app/shared';

/**
 * In-memory log of recent save attempts — what the user submitted to extract
 * and a one-line summary of what kebi made of it. Feeds the "a save went
 * wrong" report (ADR-051) the same way the chat transcript feeds the
 * wrong-answer report: attach the real thing, don't make the user re-type it.
 * Module-scoped (no UI renders from it) and session-only, like the transcript.
 */
const MAX_ATTEMPTS = 5;
// Match the gateway DTO caps so an attached attempt never turns into a 400.
const INPUT_MAX = 1000;
const RESULT_MAX = 500;

let attempts: FeedbackSaveAttempt[] = [];

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function recordSaveAttempt(input: string, result: string): void {
  attempts.push({
    input: clip(input, INPUT_MAX),
    result: clip(result, RESULT_MAX),
    at: new Date().toISOString(),
  });
  attempts = attempts.slice(-MAX_ATTEMPTS);
}

/** Newest-last copy of the recorded attempts; empty when nothing saved yet. */
export function recentSaveAttempts(): FeedbackSaveAttempt[] {
  return [...attempts];
}

/** Test hook. */
export function clearSaveHistory(): void {
  attempts = [];
}
