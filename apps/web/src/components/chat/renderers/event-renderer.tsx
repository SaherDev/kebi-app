import type { SseEvent } from '@kebi-app/shared';
import { ReasoningStepRenderer } from './reasoning-step-renderer';
import { MessageRenderer } from './message-renderer';
import { DoneRenderer } from './done-renderer';
import { ErrorRenderer } from './error-renderer';

export function EventRenderer({ event }: { event: SseEvent }) {
  switch (event.type) {
    case 'reasoning_step':
      return <ReasoningStepRenderer data={event.data} />;
    case 'message':
      return <MessageRenderer data={event.data} />;
    // Deltas are never drawn frame-by-frame: they accumulate into the prose and
    // the answer that `foldChatStream` derives for the turn (ADR-055).
    case 'reasoning_delta':
    case 'message_delta':
      return null;
    case 'done':
      return <DoneRenderer data={event.data} />;
    case 'error':
      return <ErrorRenderer data={event.data} />;
  }
}
