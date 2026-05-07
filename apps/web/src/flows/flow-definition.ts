import type { ClientIntent } from '@kebi-app/shared';

export type FlowId = 'consult' | 'recall' | 'save' | 'assistant' | 'clarification';

export type HomePhase =
  | 'hydrating'
  | 'cold-0'
  | 'cold-1-4'
  | 'chip-selection'
  | 'taste-profile'
  | 'idle'
  | 'thinking'
  | 'result'
  | 'recall'
  | 'save-sheet'
  | 'save-snackbar'
  | 'save-duplicate'
  | 'assistant-reply'
  | 'error';

export interface FlowDefinition {
  id: FlowId;
  matches: {
    clientIntent?: ClientIntent;
    responseType?: string;
  };
  phase: HomePhase;
  inputPlaceholderKey: string;
}
