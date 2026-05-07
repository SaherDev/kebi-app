'use client';

import { useEffect, type MutableRefObject } from 'react';
import type { SignalTier, SseReasoningStep } from '@kebi-app/shared';
import { useChatStream } from '../../hooks/use-chat-stream';
import { useChatStreamStore } from '../../store/chat-stream.store';
import { EventRenderer } from './renderers/event-renderer';
import { LiveReasoning } from './renderers/reasoning-step-renderer';

interface ChatStreamProps {
  streamingMessage: string | null;
  signalTier: SignalTier | null;
  onComplete: () => void;
  onStop: () => void;
  stopRef?: MutableRefObject<(() => void) | null>;
}

export function ChatStream({ streamingMessage, signalTier, onComplete, onStop, stopRef }: ChatStreamProps) {
  const { stop } = useChatStream(streamingMessage, {
    signalTier,
    onComplete,
    onStop,
    onError: onStop,
  });

  useEffect(() => {
    if (stopRef) stopRef.current = stop;
  }, [stop, stopRef]);

  const phase = useChatStreamStore((s) => s.phase);
  const events = useChatStreamStore((s) => s.events);
  const error = useChatStreamStore((s) => s.error);

  if (!streamingMessage && phase === 'idle') return null;

  const isStreaming = phase === 'streaming' || phase === 'idle';
  // During streaming: show all steps (including debug) for real-time progress.
  // agent.tool_decision filtered because it duplicates the final message.
  const reasoningSteps = events
    .filter((e) => e.type === 'reasoning_step')
    .map((e) => (e.type === 'reasoning_step' ? e.data : null))
    .filter((s) => s!.step !== 'agent.tool_decision') as SseReasoningStep[];

  const hasMessage = events.some((e) => e.type === 'message');
  const nonReasoningEvents = events.filter((e) => e.type !== 'reasoning_step');

  return (
    <div className="flex flex-col gap-3">
      {isStreaming && events.length === 0 && (
        <div className="flex gap-1 px-1 py-2">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
        </div>
      )}

      <LiveReasoning steps={reasoningSteps} isStreaming={isStreaming} writingResponse={isStreaming && !hasMessage} />

      {nonReasoningEvents.map((event, i) => (
        <EventRenderer key={i} event={event} />
      ))}

      {phase === 'error' && error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
