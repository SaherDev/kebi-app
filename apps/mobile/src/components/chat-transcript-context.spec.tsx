import { useRef } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import type { ChatEntity, SseReasoningStep } from '@kebi-app/shared';
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

const LUIGIS: ChatEntity = {
  kind: 'venue',
  key: 'c0ffee00',
  name: 'Luigis',
  uri: 'kebi://venue/c0ffee00',
  icon: '🍕',
};

/**
 * Probe: holds the active kebi key and exposes a button per action; renders each
 * turn as a parseable line so tests can assert the reduced state.
 */
function Probe() {
  const tr = useChatTranscript();
  const key = useRef('');
  const snapshot = useRef<ReturnType<typeof useChatTranscript>['turns']>([]);
  const act = (label: string, fn: () => void) => (
    <Pressable accessibilityLabel={label} onPress={fn} />
  );
  return (
    <>
      {act('start', () => (key.current = tr.startTurn('hey')))}
      {act('clear', () => {
        snapshot.current = tr.turns;
        tr.clearTranscript();
      })}
      {act('restore', () => tr.restoreTranscript(snapshot.current))}
      {act('step-active', () => tr.upsertStep(key.current, step({ status: 'active', summary: null })))}
      {act('step-done', () => tr.upsertStep(key.current, step({ status: 'done', summary: '2 spots' })))}
      {act('step-other', () => tr.upsertStep(key.current, step({ id: 'rank#1', title: 'ranked' })))}
      {act('step-debug', () => tr.upsertStep(key.current, step({ id: 'dbg#9', visibility: 'debug' })))}
      {act('delta-step', () => tr.appendStepText(key.current, { id: 'find_saved#0', text: 'checking ' }))}
      {act('delta-step2', () => tr.appendStepText(key.current, { id: 'find_saved#0', text: 'your saves' }))}
      {act('delta-step-unknown', () => tr.appendStepText(key.current, { id: 'ghost#9', text: 'nope' }))}
      {act('delta-msg', () => tr.appendMessage(key.current, { text: 'tonight, ' }))}
      {act('delta-msg2', () => tr.appendMessage(key.current, { text: 'go to Luigis' }))}
      {act('delta-msg-promote', () => tr.appendMessage(key.current, { text: 'tonight, ', promote: true }))}
      {act('msg', () => tr.setMessage(key.current, 'here you go', []))}
      {act('msg-linked', () => tr.setMessage(key.current, 'tonight is [Luigis](kebi://venue/c0ffee00)', [LUIGIS]))}
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
  const entities = t.entities.map((e) => `${e.kind}:${e.key}`).join(',');
  const narration = t.steps.map((s) => s.narration ?? '').join(',');
  return `${t.key}|kebi|status:${t.status}|steps:${t.steps.length}|st:${statuses}|narr:${narration}|msg:${t.message}|entities:${entities}|collapsed:${t.collapsed}|stopped:${t.stopped ?? false}`;
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

  it('appends reasoning deltas onto the active row they name', () => {
    const { press, kebi } = setup();
    press('start');
    press('step-active');
    press('delta-step');
    press('delta-step2');
    // One row, text accumulated in arrival order — not one row per delta.
    expect(kebi()).toContain('steps:1');
    expect(kebi()).toContain('narr:checking your saves');
  });

  it("ignores a reasoning delta for a row that isn't on screen", () => {
    const { press, kebi } = setup();
    press('start');
    press('step-active');
    press('delta-step-unknown');
    expect(kebi()).toContain('steps:1');
    expect(kebi()).toContain('narr:');
    expect(kebi()).not.toContain('nope');
  });

  it("the step's done frame supersedes the text that typed out", () => {
    const { press, kebi } = setup();
    press('start');
    press('step-active');
    press('delta-step');
    press('step-done');
    expect(kebi()).toContain('narr:'); // cleared
    expect(kebi()).not.toContain('checking ');
  });

  it('appends message deltas into the answer', () => {
    const { press, kebi } = setup();
    press('start');
    press('delta-msg');
    press('delta-msg2');
    expect(kebi()).toContain('msg:tonight, go to Luigis');
  });

  it('promote seeds the answer and clears the row that was typing', () => {
    const { press, kebi } = setup();
    press('start');
    press('step-active');
    press('delta-step'); // text typing into the thinking row
    press('delta-msg-promote'); // …turns out to be the answer's start
    expect(kebi()).toContain('narr:'); // row kept, its typed text cleared
    expect(kebi()).toContain('steps:1');
    // Seeded with the full prefix, NOT appended to what was already there.
    expect(kebi()).toContain('msg:tonight, ');
    press('delta-msg2');
    expect(kebi()).toContain('msg:tonight, go to Luigis');
  });

  it('the final message frame replaces the streamed text wholesale', () => {
    const { press, kebi } = setup();
    press('start');
    press('delta-msg');
    press('delta-msg2');
    press('msg-linked');
    // Not appended to, not diffed — replaced, and only now carrying links.
    expect(kebi()).toContain('msg:tonight is [Luigis](kebi://venue/c0ffee00)');
    expect(kebi()).toContain('entities:venue:c0ffee00');
  });

  it('keeps the streamed answer when the user stops mid-stream', () => {
    const { press, kebi } = setup();
    press('start');
    press('step-active');
    press('delta-step');
    press('delta-msg'); // half an answer on screen
    press('stop');
    expect(kebi()).toContain('status:done');
    expect(kebi()).toContain('stopped:true');
    // What was rendered stays — the partial answer and the partial thinking.
    expect(kebi()).toContain('msg:tonight, ');
    expect(kebi()).toContain('narr:checking ');
  });

  it('stores the message frame entities alongside the text', () => {
    const { press, kebi } = setup();
    press('start');
    press('msg-linked');
    expect(kebi()).toContain('entities:venue:c0ffee00');
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

  it('clearTranscript empties the transcript', () => {
    const { press, queryByText } = setup();
    press('start');
    press('clear');
    expect(queryByText(/you\|hey/)).toBeNull();
    expect(queryByText(/kebi\|/)).toBeNull();
  });

  it('restoreTranscript puts the cleared turns back (undo)', () => {
    const { press, getByText } = setup();
    press('start');
    press('finish');
    press('clear');
    press('restore');
    expect(getByText(/you\|hey/)).toBeTruthy();
    expect(getByText(/kebi\|status:done/)).toBeTruthy();
  });

  it('restore prepends the snapshot before turns sent after the clear', () => {
    const { press, getAllByText } = setup();
    press('start');
    press('clear');
    press('start'); // a new turn sent during the undo window
    press('restore');
    const you = getAllByText(/you\|hey/);
    expect(you).toHaveLength(2);
    const kebiLines = getAllByText(/kebi\|/).map((n) => n.props.children as string);
    expect(kebiLines).toHaveLength(2);
    // Restored (older) turn first, the newer turn keeps its place after it.
    expect(kebiLines[0]).toContain('kebi-1|');
    expect(kebiLines[1]).toContain('kebi-2|');
  });
});
