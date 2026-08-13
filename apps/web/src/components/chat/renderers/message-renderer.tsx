import type { SseMessage } from '@kebi-app/shared';

/**
 * A run of the turn's text — either a prose segment the agent said while it
 * worked, or the answer itself. Rendered identically on purpose: when a promoted
 * segment becomes the answer the words must not visibly move, and when the final
 * `message` frame replaces the streamed text the only change the user should see
 * is names becoming links.
 *
 * Delta text is plain prose by contract — never linkified or transformed here;
 * only the final frame carries `kebi://` markdown (ADR-055).
 */
export type ProseTier = 'answer' | 'commentary';

/**
 * `answer` is the answer itself, at full message size and contrast;
 * `commentary` is the agent working — muted and a step smaller, so a turn does
 * not read as one long ramble. `promote` marks the boundary between them.
 */
const TIER: Record<ProseTier, string> = {
  answer: 'text-sm text-foreground/80',
  commentary: 'text-xs text-muted-foreground',
};

export function StreamProse({ text, tier = 'answer' }: { text: string; tier?: ProseTier }) {
  return (
    <p className={`whitespace-pre-wrap break-words leading-relaxed ${TIER[tier]}`}>{text}</p>
  );
}

export function MessageRenderer({ data }: { data: SseMessage }) {
  return <StreamProse text={data.content} />;
}
