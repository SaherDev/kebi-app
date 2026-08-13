'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { StreamSegment } from '../../lib/fold-chat-stream';
import { ReasoningCard } from './renderers/reasoning-step-renderer';
import { StreamProse } from './renderers/message-renderer';

/**
 * Everything a turn did before it answered — the agent's commentary and the work
 * chips between it — with two lives (ADR-055):
 *
 * - **While it streams**, the process plays live and interleaved, each chip
 *   carrying its own "thought for 0.5s" micro-header.
 * - **Once it settles**, all of it folds behind a single `▸ thought for 12s`
 *   header, leaving the settled transcript as one line plus a clean answer.
 *
 * The answer is NOT in here — it renders after, at full contrast, so the
 * boundary `promote` marks is also the boundary on screen.
 */
export function TurnProcess({
  segments,
  settled,
  durationMs,
  isStreaming = false,
}: {
  segments: StreamSegment[];
  /** The turn finished — fold everything behind one header. */
  settled: boolean;
  /** Total thinking time for the settled header (summed step durations). */
  durationMs?: number;
  isStreaming?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const hasContent = segments.some((s) => (s.kind === 'work' ? s.steps.length > 0 : s.text !== ''));
  if (!hasContent) return null;

  const body = (
    <div className="flex flex-col gap-3">
      {segments.map((segment) =>
        segment.kind === 'work' ? (
          <ReasoningCard
            key={segment.key}
            steps={segment.steps}
            isStreaming={isStreaming && segment.steps.some((s) => s.status === 'active')}
            // Settled, the turn's own header owns the disclosure, so the chips
            // drop theirs and the expanded process is prose and rows in order.
            bare={settled}
          />
        ) : segment.text ? (
          <StreamProse key={segment.key} text={segment.text} tier="commentary" />
        ) : null,
      )}
    </div>
  );

  // Still working: the process IS the content, so it plays in place.
  if (!settled) return body;

  const seconds = durationMs != null ? ` ${Math.max(durationMs / 1000, 0.1).toFixed(1)}s` : '';

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex items-center gap-2 text-start text-xs text-muted-foreground"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span>{`thought for${seconds}`}</span>
      </button>
      {expanded && body}
    </div>
  );
}
