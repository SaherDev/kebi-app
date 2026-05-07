'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import type { ReasoningStep } from '@kebi-app/shared';

interface ConsultThinkingProps {
  query: string;
  reasoningSteps: ReasoningStep[];
  fetchComplete: boolean;
  onAnimationComplete: () => void;
}

const STEP_LABELS: Record<string, string> = {
  intent_parsing: 'Understanding your request',
  retrieval: 'Checking your saved places',
  discovery: 'Discovering nearby options',
  validation: 'Validating options',
  ranking: 'Ranking results',
  response: 'Finding your match',
  completion: 'Finding your match',
};

function stepLabel(step: string): string {
  return STEP_LABELS[step] ?? step.replace(/_/g, ' ');
}

const STEP_INTERVAL_MS = 350;
const FINAL_PAUSE_MS = 400;

export function ConsultThinking({
  query,
  reasoningSteps,
  fetchComplete,
  onAnimationComplete,
}: ConsultThinkingProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const onCompleteRef = useRef(onAnimationComplete);
  onCompleteRef.current = onAnimationComplete;

  // Reveal steps one by one once fetch is done
  useEffect(() => {
    if (!fetchComplete || reasoningSteps.length === 0) return;

    let index = 0;
    const tick = () => {
      index += 1;
      setVisibleCount(index);
      if (index < reasoningSteps.length) {
        timer = setTimeout(tick, STEP_INTERVAL_MS);
      } else {
        timer = setTimeout(() => onCompleteRef.current(), FINAL_PAUSE_MS);
      }
    };
    let timer = setTimeout(tick, STEP_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [fetchComplete, reasoningSteps]);

  // Fallback: no steps returned
  useEffect(() => {
    if (!fetchComplete || reasoningSteps.length > 0) return;
    const timer = setTimeout(() => onCompleteRef.current(), 300);
    return () => clearTimeout(timer);
  }, [fetchComplete, reasoningSteps.length]);

  return (
    <div className="flex flex-col gap-1 py-1">
      {/* Loading dots while waiting */}
      {!fetchComplete && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
          </div>
          <span className="truncate max-w-[200px]">{query}</span>
        </div>
      )}

      {/* Reasoning steps with checkmark circles */}
      {reasoningSteps.slice(0, visibleCount).map((s) => (
        <div
          key={s.step}
          className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-1 duration-200"
        >
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary">
            <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium leading-tight">{stepLabel(s.step)}</span>
            <span className="text-xs text-muted-foreground leading-snug">{s.summary}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
