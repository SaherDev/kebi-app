'use client';

import { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { SseReasoningStep } from '@kebi-app/shared';

function useElapsed() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(id);
  }, []);
  return elapsed;
}

/**
 * The work chip — "thought for 2s" over the tools the agent ran, collapsible.
 *
 * WORK ONLY (ADR-055): the agent's own talk is not a row here, it renders as
 * message prose in the transcript, because the same sentences arrive as
 * `reasoning_delta` text and drawing them in both places would print each one
 * twice. `foldChatStream` decides what reaches this component.
 */
export function ReasoningCard({
  steps,
  isStreaming = false,
  writingResponse = false,
  bare = false,
}: {
  steps: SseReasoningStep[];
  isStreaming?: boolean;
  writingResponse?: boolean;
  /**
   * Rows only — no header, no card. Used inside an expanded turn process, where
   * the turn's own "thought for 19.7s" header already owns the disclosure: a
   * header per chip there stacks disclosures inside the one just opened, and
   * times single tool calls at "0.1s".
   */
  bare?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const elapsed = useElapsed();
  const latestStep = steps[steps.length - 1];
  const stepCount = steps.length;
  const hasSteps = stepCount > 0;
  // Settled, the chip is one line; while it runs it says what is happening now.
  const headerLabel = isStreaming
    ? (latestStep?.title ?? 'thinking')
    : `thought for ${elapsed}s`;

  if (bare) {
    return (
      <div className="flex flex-col gap-3.5 min-w-0">
        {steps.map((step, i) => (
          <p key={i} className="text-sm italic leading-relaxed break-words text-foreground/60">
            {step.summary ?? step.title}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden min-w-0">
      {/* Header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-start"
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            isStreaming ? 'bg-primary animate-pulse' : 'bg-muted-foreground/40'
          }`}
        />
        <span className="flex-1 truncate text-sm italic text-muted-foreground min-w-0">
          {headerLabel}
        </span>
        {hasSteps && (
          <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
            {isStreaming ? `${elapsed}s` : `${stepCount} ${stepCount === 1 ? 'STEP' : 'STEPS'}`}
            {expanded
              ? <ChevronUp className="h-3 w-3" />
              : <ChevronDown className="h-3 w-3" />}
          </span>
        )}
        {!hasSteps && isStreaming && (
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/40 shrink-0">
            {elapsed}s
          </span>
        )}
      </button>

      {/* Expanded body */}
      {expanded && hasSteps && (
        <div className="flex flex-col gap-3.5 border-t border-border/20 px-5 pb-5 pt-4">
          {steps.map((step, i) => (
            <p
              key={i}
              className={`italic leading-relaxed break-words animate-fade-in ${
                step.visibility === 'debug'
                  ? 'text-xs text-foreground/30'
                  : 'text-sm text-foreground/60'
              }`}
            >
              {step.summary}
            </p>
          ))}
          {writingResponse && (
            <p className="text-sm italic leading-relaxed text-foreground/30 animate-pulse">
              Writing response…
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Thin wrapper used inline during streaming
interface LiveReasoningProps {
  steps: SseReasoningStep[];
  isStreaming: boolean;
  writingResponse?: boolean;
}

export function LiveReasoning({ steps, isStreaming, writingResponse }: LiveReasoningProps) {
  if (steps.length === 0) return null;
  return <ReasoningCard steps={steps} isStreaming={isStreaming} writingResponse={writingResponse} />;
}

// Kept for backwards-compat with thread entries that use it directly
export function ReasoningStepRenderer({ data }: { data: SseReasoningStep }) {
  return (
    <p className="text-sm italic leading-relaxed text-foreground/60 break-words">
      {data.summary}
    </p>
  );
}
