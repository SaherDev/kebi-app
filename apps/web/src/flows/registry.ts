import type { FlowDefinition, FlowId } from './flow-definition';
import type { ClientIntent } from '@kebi-app/shared';
import { consultFlow } from './consult';
import { saveFlow } from './save';
import { recallFlow } from './recall';

const assistantFlow: FlowDefinition = {
  id: 'assistant',
  matches: { clientIntent: 'assistant', responseType: 'assistant' },
  phase: 'thinking',
  inputPlaceholderKey: 'chat.placeholder',
};

const clarificationFlow: FlowDefinition = {
  id: 'clarification',
  matches: { responseType: 'clarification' },
  phase: 'thinking',
  inputPlaceholderKey: 'chat.placeholder',
};

export const FLOW_REGISTRY = {
  consult: consultFlow,
  recall: recallFlow,
  save: saveFlow,
  assistant: assistantFlow,
  clarification: clarificationFlow,
} as const satisfies Record<FlowId, FlowDefinition>;

export const FLOW_BY_CLIENT_INTENT: Partial<Record<ClientIntent, FlowDefinition>> = {
  consult: FLOW_REGISTRY.consult,
  recall: FLOW_REGISTRY.recall,
  save: FLOW_REGISTRY.save,
  assistant: FLOW_REGISTRY.assistant,
};
