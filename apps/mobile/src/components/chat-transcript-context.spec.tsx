import { useRef } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import type { ChatEntity, SseReasoningStep } from '@kebi-app/shared';
import {
  ChatTranscriptProvider,
  useChatTranscript,
  type KebiTurn,
} from './chat-transcript-context';

/** A work step — a tool the agent ran; renders as a row inside a chip. */
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

/** A talk step — the agent speaking; renders as message prose, never a row. */
function talk(over: Partial<SseReasoningStep> = {}): SseReasoningStep {
  return {
    id: 'agent.tool_decision#0',
    step: 'agent.tool_decision',
    title: 'thinking',
    summary: null,
    status: 'active',
    visibility: 'user',
    ...over,
  };
}

const TALK_ID = 'agent.tool_decision#0';

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
      {act('step-timed', () => tr.upsertStep(key.current, step({ id: 't#1', status: 'done', summary: 'a', duration_ms: 1200 })))}
      {act('step-timed2', () => tr.upsertStep(key.current, step({ id: 't#2', status: 'done', summary: 'b', duration_ms: 800 })))}
      {act('talk-active', () => tr.upsertStep(key.current, talk()))}
      {act('talk-done', () => tr.upsertStep(key.current, talk({ status: 'done', summary: 'checked your saves' })))}
      {act('talk2-active', () => tr.upsertStep(key.current, talk({ id: 'agent.tool_decision#1' })))}
      {act('delta-step', () => tr.appendStepText(key.current, { id: TALK_ID, text: 'checking ' }))}
      {act('delta-step2', () => tr.appendStepText(key.current, { id: TALK_ID, text: 'your saves' }))}
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
  const rows = t.segments.flatMap((s) => (s.kind === 'work' ? s.steps : []));
  const statuses = rows.map((s) => s.status).join(',');
  const entities = t.entities.map((e) => `${e.kind}:${e.key}`).join(',');
  // The turn's body as the screen draws it: `prose(…)` for a sentence the agent
  // said, `work[…]` for a chip of tool rows — in stream order.
  const shape = t.segments
    .map((s) => (s.kind === 'prose' ? `prose(${s.text})` : `work[${s.steps.map((r) => r.id).join(' ')}]`))
    .join(' ');
  return `${t.key}|kebi|status:${t.status}|steps:${rows.length}|st:${statuses}|shape:${shape}|msg:${t.message}|entities:${entities}|collapsed:${t.collapsed}|stopped:${t.stopped ?? false}|spent:${t.stepDurationMs ?? ''}`;
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

  it('renders the agent talk as prose, never as a work row', () => {
    const { press, kebi } = setup();
    press('start');
    press('talk-active');
    press('delta-step');
    press('delta-step2');
    // Prose accumulates in arrival order, and adds no row to the chip.
    expect(kebi()).toContain('shape:prose(checking your saves)');
    expect(kebi()).toContain('steps:0');
  });

  it("ignores a reasoning delta for a segment that isn't open", () => {
    const { press, kebi } = setup();
    press('start');
    press('talk-active');
    press('delta-step-unknown');
    expect(kebi()).toContain('shape:prose()');
    expect(kebi()).not.toContain('nope');
  });

  it("the talk step's done summary supersedes the text that typed out", () => {
    const { press, kebi } = setup();
    press('start');
    press('talk-active');
    press('delta-step');
    press('talk-done');
    // Replaced wholesale by the authoritative summary — and still prose, not a
    // row: drawing the summary as a row too would print the sentence twice.
    expect(kebi()).toContain('shape:prose(checked your saves)');
    expect(kebi()).toContain('steps:0');
  });

  it('interleaves prose and work chips in stream order', () => {
    const { press, kebi } = setup();
    press('start');
    press('talk-active');
    press('delta-step'); // agent says something
    press('step-active'); // then runs a tool
    press('talk2-active'); // then says something else
    expect(kebi()).toContain('shape:prose(checking ) work[find_saved#0] prose()');
  });

  it('groups consecutive work steps into one chip', () => {
    const { press, kebi } = setup();
    press('start');
    press('step-active');
    press('step-other');
    expect(kebi()).toContain('shape:work[find_saved#0 rank#1]');
    press('step-debug');
    expect(kebi()).toContain('shape:work[find_saved#0 rank#1]'); // debug never lands
  });

  it("a late done frame updates its own chip's row, not a new chip", () => {
    const { press, kebi } = setup();
    press('start');
    press('step-active');
    press('talk2-active'); // prose closes the chip
    press('step-done'); // the tool finishes afterwards
    expect(kebi()).toContain('shape:work[find_saved#0] prose()');
    expect(kebi()).toContain('st:done');
  });

  it('appends message deltas into the answer', () => {
    const { press, kebi } = setup();
    press('start');
    press('delta-msg');
    press('delta-msg2');
    expect(kebi()).toContain('msg:tonight, go to Luigis');
  });

  it('promote empties the prose it came from so the words are not doubled', () => {
    const { press, kebi } = setup();
    press('start');
    press('talk-active');
    press('delta-step'); // "checking " typing as prose
    press('delta-msg-promote'); // …turns out to be the answer's start
    // The segment stays (so its done frame can't re-add the words) but is empty:
    // the same text now renders as the answer, in the same place. Nothing moves.
    expect(kebi()).toContain('shape:prose()');
    expect(kebi()).toContain('msg:tonight, ');
    press('delta-msg2');
    expect(kebi()).toContain('msg:tonight, go to Luigis');
  });

  it("a promoted segment ignores its own done summary", () => {
    const { press, kebi } = setup();
    press('start');
    press('talk-active');
    press('delta-step');
    press('delta-msg-promote');
    press('talk-done'); // summary would duplicate what is now the answer
    expect(kebi()).toContain('shape:prose()');
    expect(kebi()).toContain('msg:tonight, ');
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

  it('keeps the streamed prose and answer when the user stops mid-stream', () => {
    const { press, kebi } = setup();
    press('start');
    press('talk-active');
    press('delta-step');
    press('step-active');
    press('delta-msg'); // half an answer on screen
    press('stop');
    expect(kebi()).toContain('status:done');
    expect(kebi()).toContain('stopped:true');
    // What was rendered stays — the partial answer and the partial prose.
    expect(kebi()).toContain('msg:tonight, ');
    expect(kebi()).toContain('prose(checking )');
  });

  it('folds the process away when the turn settles', () => {
    const { press, kebi } = setup();
    press('start');
    press('talk-active');
    press('delta-step');
    expect(kebi()).toContain('collapsed:false'); // plays live while it streams
    press('finish');
    // Settled: one "thought for" header over a clean answer, expandable on tap.
    expect(kebi()).toContain('collapsed:true');
  });

  it('sums the step durations for the settled header', () => {
    const { press, kebi } = setup();
    press('start');
    press('step-timed'); // 1200ms of work
    press('step-timed2'); // + 800ms
    expect(kebi()).toContain('spent:2000');
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

/**
 * A real turn captured off the local kebi backend on 2026-08-11 ("what should i
 * do tonight in canggu?"), replayed through the reducer. The three things this
 * pins are the ones the spec alone would let you get wrong:
 *
 * 1. `step` mutates on the done frame (`find_known` → `find_known.summary`)
 *    while `id` stays put, so talk/work must be classified by `id`.
 * 2. The location steps ride as `debug` and never reach the transcript.
 * 3. The second talk step's `done` lands AFTER `promote`, carrying "putting the
 *    answer together" — a stray line of commentary between the work and the
 *    answer if it were rendered.
 */
describe('a real captured turn', () => {
  function ReplayProbe() {
    const tr = useChatTranscript();
    const key = useRef('');
    return (
      <>
        <Pressable
          accessibilityLabel="replay"
          onPress={() => {
            key.current = tr.startTurn('what should i do tonight in canggu?');
            const k = key.current;
            const talkStep = (id: string, status: 'active' | 'done', summary: string | null, ms?: number) =>
              tr.upsertStep(k, {
                id,
                step: 'agent.tool_decision',
                title: 'thinking',
                summary,
                status,
                visibility: 'user',
                ...(ms !== undefined ? { duration_ms: ms } : {}),
              });

            // location — debug, dropped
            tr.upsertStep(k, { id: 'agent.location#0', step: 'agent.location', title: 'checking your location', summary: null, status: 'active', visibility: 'debug' });
            tr.upsertStep(k, { id: 'agent.location#0', step: 'agent.location_resolved', title: 'found your location', summary: 'around Canggu, Bali, Indonesia', status: 'done', visibility: 'debug', duration_ms: 2915.97 });
            // talk #0
            talkStep('agent.tool_decision#0', 'active', null);
            tr.appendStepText(k, { id: 'agent.tool_decision#0', text: "let me see what's good" });
            tr.appendStepText(k, { id: 'agent.tool_decision#0', text: ' for a tuesday night in canggu' });
            talkStep('agent.tool_decision#0', 'done', "let me see what's good for a tuesday night in canggu", 1567.79);
            // work — note the step rename on done
            tr.upsertStep(k, { id: 'find_known#0', step: 'find_known', title: 'checked what I know around here', summary: null, status: 'active', visibility: 'user' });
            tr.upsertStep(k, { id: 'find_known#0', step: 'find_known.summary', title: 'checked what I know around here', summary: '5 spots — Motel Mexicola | Canggu, +3 more', status: 'done', visibility: 'user', duration_ms: 30.64 });
            // talk #1 → promoted into the answer
            talkStep('agent.tool_decision#1', 'active', null);
            tr.appendStepText(k, { id: 'agent.tool_decision#1', text: 'tuesday night in canggu is solid.' });
            tr.appendMessage(k, { text: 'tuesday night in canggu is solid.', promote: true });
            tr.appendMessage(k, { text: ' get there before it fills up.' });
            talkStep('agent.tool_decision#1', 'done', 'putting the answer together', 2951.47);
            tr.setMessage(k, 'tuesday night in [canggu](kebi://area/aWQ) is solid. get there before it fills up.', [
              { kind: 'area', key: 'id/bali/canggu', name: 'canggu', uri: 'kebi://area/aWQ', icon: '🏄' },
            ]);
            tr.finishTurn(k, 1);
          }}
        />
        {tr.turns.map((t) =>
          t.role === 'kebi' ? <Text key={t.key}>{line(t)}</Text> : null,
        )}
      </>
    );
  }

  function replay() {
    const utils = render(
      <ChatTranscriptProvider>
        <ReplayProbe />
      </ChatTranscriptProvider>,
    );
    fireEvent.press(utils.getByLabelText('replay'));
    return utils.getByText(/kebi\|/).props.children as string;
  }

  it('folds into commentary, one work chip, and the linked answer', () => {
    const l = replay();
    expect(l).toContain(
      "shape:prose(let me see what's good for a tuesday night in canggu) work[find_known#0] prose()",
    );
    expect(l).toContain('entities:area:id/bali/canggu');
  });

  it('drops the talk summary that lands after promote', () => {
    expect(replay()).not.toContain('putting the answer together');
  });

  it('sums only user-visible step time — the debug location is not counted', () => {
    // 1567.79 + 30.64 + 2951.47, without the location step's 2915.97.
    expect(replay()).toContain('spent:4549.9');
  });

  it('settles collapsed, so the turn reads as one line plus the answer', () => {
    expect(replay()).toContain('collapsed:true');
  });
});
