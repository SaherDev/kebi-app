import { useRef } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import type { SseReasoningStep, SseToolResult } from '@kebi-app/shared';
import {
  ChatTranscriptProvider,
  useChatTranscript,
  type KebiTurn,
} from './chat-transcript-context';

function step(over: Partial<SseReasoningStep>): SseReasoningStep {
  return {
    id: 'find_saved#0',
    step: 'find_saved',
    title: 'searched',
    summary: null,
    status: 'active',
    visibility: 'user',
    ...over,
  };
}

const TOOL: SseToolResult = { tool: 'find_saved', tool_call_id: 'c1', payload: { candidates: [] } };

/**
 * Probe: holds the active kebi key and exposes a button per action; renders each
 * turn as a parseable line so tests can assert the reduced state.
 */
function Probe() {
  const tr = useChatTranscript();
  const key = useRef('');
  const act = (label: string, fn: () => void) => (
    <Pressable accessibilityLabel={label} onPress={fn} />
  );
  return (
    <>
      {act('start', () => (key.current = tr.startTurn('hey')))}
      {act('step-active', () => tr.upsertStep(key.current, step({ status: 'active', summary: null })))}
      {act('step-done', () => tr.upsertStep(key.current, step({ status: 'done', summary: '2 spots' })))}
      {act('step-other', () => tr.upsertStep(key.current, step({ id: 'rank#1', title: 'ranked' })))}
      {act('step-debug', () => tr.upsertStep(key.current, step({ id: 'dbg#9', visibility: 'debug' })))}
      {act('msg', () => tr.setMessage(key.current, 'here you go'))}
      {act('tool-a', () => tr.addToolResult(key.current, { ...TOOL, tool_call_id: 'a' }))}
      {act('tool-b', () => tr.addToolResult(key.current, { ...TOOL, tool_call_id: 'b' }))}
      {act('finish', () => tr.finishTurn(key.current, 1))}
      {act('stop', () => tr.stopTurn(key.current))}
      {act('fail', () => tr.failTurn(key.current, 'boom'))}
      {tr.turns.map((t) =>
        t.role === 'you' ? (
          <Text key={t.key}>{`${t.key}|you|${t.text}`}</Text>
        ) : (
          <Text key={t.key}>{line(t)}</Text>
        ),
      )}
    </>
  );
}

function line(t: KebiTurn): string {
  const statuses = t.steps.map((s) => s.status).join(',');
  const tools = t.toolResults.map((r) => r.tool_call_id).join(',');
  return `${t.key}|kebi|status:${t.status}|steps:${t.steps.length}|st:${statuses}|msg:${t.message}|tools:${tools}|collapsed:${t.collapsed}|stopped:${t.stopped ?? false}`;
}

function setup() {
  const utils = render(
    <ChatTranscriptProvider>
      <Probe />
    </ChatTranscriptProvider>,
  );
  const press = (label: string) => fireEvent.press(utils.getByLabelText(label));
  const kebi = () => (utils.getByText(/kebi\|/).props.children as string);
  return { ...utils, press, kebi };
}

describe('ChatTranscriptProvider', () => {
  it('startTurn appends a you turn and a streaming kebi turn', () => {
    const { press, getByText } = setup();
    press('start');
    expect(getByText(/you\|hey/)).toBeTruthy();
    expect(getByText(/kebi\|status:streaming/)).toBeTruthy();
  });

  it('collapses the previous kebi turn when a new turn starts', () => {
    const { press, getAllByText } = setup();
    press('start');
    press('start');
    const kebiLines = getAllByText(/kebi\|/).map((n) => n.props.children as string);
    // First (older) kebi turn collapsed, the new one open.
    expect(kebiLines[0]).toContain('collapsed:true');
    expect(kebiLines[1]).toContain('collapsed:false');
  });

  it('upserts a step by id (active→done is one row, not two)', () => {
    const { press, kebi } = setup();
    press('start');
    press('step-active');
    expect(kebi()).toContain('steps:1');
    expect(kebi()).toContain('st:active');
    press('step-done');
    expect(kebi()).toContain('steps:1');
    expect(kebi()).toContain('st:done');
  });

  it('appends a distinct step id and skips debug steps', () => {
    const { press, kebi } = setup();
    press('start');
    press('step-active');
    press('step-other');
    expect(kebi()).toContain('steps:2');
    press('step-debug');
    expect(kebi()).toContain('steps:2'); // debug not rendered
  });

  it('keeps tool results in arrival order', () => {
    const { press, kebi } = setup();
    press('start');
    press('tool-a');
    press('tool-b');
    expect(kebi()).toContain('tools:a,b');
  });

  it('finishTurn marks the turn done', () => {
    const { press, kebi } = setup();
    press('start');
    press('msg');
    press('finish');
    expect(kebi()).toContain('status:done');
    expect(kebi()).toContain('stopped:false');
  });

  it('stopTurn finishes the turn and flags it stopped', () => {
    const { press, kebi } = setup();
    press('start');
    press('step-active');
    press('stop');
    expect(kebi()).toContain('status:done');
    expect(kebi()).toContain('stopped:true');
  });

  it('failTurn errors the turn and leaves an active step as a skeleton', () => {
    const { press, kebi } = setup();
    press('start');
    press('step-active');
    press('fail');
    expect(kebi()).toContain('status:error');
    expect(kebi()).toContain('st:active'); // interrupted step stays a skeleton
  });
});
