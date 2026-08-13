'use client';

import { useEffect, useMemo, type MutableRefObject } from 'react';
import type { SignalTier } from '@kebi-app/shared';
import { useChatStream } from '../../hooks/use-chat-stream';
import { useChatStreamStore } from '../../store/chat-stream.store';
import { foldChatStream } from '../../lib/fold-chat-stream';
import { TurnProcess } from './turn-process';
import { StreamProse } from './renderers/message-renderer';

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

  // Re-derived per frame while streaming — memoized so a turn that is still
  // typing doesn't re-fold its whole event log on every token.
  const { segments, message, hasMessage } = useMemo(() => foldChatStream(events), [events]);

  if (!streamingMessage && phase === 'idle') return null;

  const isStreaming = phase === 'streaming' || phase === 'idle';

  return (
    <div className="flex flex-col gap-3">
      {isStreaming && events.length === 0 && (
        <div className="flex gap-1 px-1 py-2">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
        </div>
      )}

      {/* The process: the agent's commentary and the work between it, playing
          live while the turn streams (ADR-055). A promoted segment is empty —
          its words are the answer below, in the same place, so nothing moves. */}
      <TurnProcess segments={segments} settled={false} isStreaming={isStreaming} />

      {/* Plain prose while it streams; the final frame swaps in the same words
          carrying `kebi://` links. Never linkified client-side. */}
      {message && <StreamProse text={message} />}

      {isStreaming && !hasMessage && segments.length > 0 && !message && (
        <p className="text-sm italic leading-relaxed text-foreground/30 animate-pulse">
          Writing response…
        </p>
      )}

      {phase === 'error' && error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
