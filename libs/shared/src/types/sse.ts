export type SseEventType = 'reasoning_step' | 'tool_result' | 'message' | 'done' | 'error';

export interface SseReasoningStep {
  step: string;
  summary: string;
  source?: 'tool' | 'agent' | 'fallback';
  visibility?: 'user' | 'debug';
  duration_ms?: number;
  timestamp?: string;
}

export interface SseToolResult {
  tool: string | null;
  tool_call_id: string | null;
  payload: Record<string, unknown> | null;
}

export interface SseMessage {
  content: string;
}

export interface SseDone {
  tool_calls_used: number;
}

export interface SseError {
  detail: string;
}

export type SseEvent =
  | { type: 'reasoning_step'; data: SseReasoningStep }
  | { type: 'tool_result'; data: SseToolResult }
  | { type: 'message'; data: SseMessage }
  | { type: 'done'; data: SseDone }
  | { type: 'error'; data: SseError };
