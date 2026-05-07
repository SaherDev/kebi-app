import type { SseEvent } from '@kebi-app/shared';
import { ReasoningStepRenderer } from './reasoning-step-renderer';
import { ToolResultRenderer } from './tool-result-renderer';
import { MessageRenderer } from './message-renderer';
import { DoneRenderer } from './done-renderer';
import { ErrorRenderer } from './error-renderer';

export function EventRenderer({ event }: { event: SseEvent }) {
  switch (event.type) {
    case 'reasoning_step':
      return <ReasoningStepRenderer data={event.data} />;
    case 'tool_result':
      return <ToolResultRenderer data={event.data} />;
    case 'message':
      return <MessageRenderer data={event.data} />;
    case 'done':
      return <DoneRenderer data={event.data} />;
    case 'error':
      return <ErrorRenderer data={event.data} />;
  }
}
