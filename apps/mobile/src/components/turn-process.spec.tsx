import { render, fireEvent } from '@testing-library/react-native';
import { TurnProcess, type TurnProcessLabels } from './turn-process';
import type { TurnSegment } from './chat-transcript-context';

const LABELS: TurnProcessLabels = {
  thinking: 'thinking',
  thought: 'thought for',
  stopped: 'stopped',
  interrupted: 'interrupted',
};

const SEGMENTS: TurnSegment[] = [
  {
    kind: 'work',
    key: 'w0',
    startedAt: 0,
    endedAt: 500,
    steps: [{ id: 'find_saved#0', status: 'done', title: 'searched your saved spots', summary: 'nothing matched' }],
  },
  { kind: 'prose', key: 'p1', stepId: 'agent.tool_decision#1', text: 'nothing saved for gili t, so here is the plan' },
];

function setup(over: Partial<Parameters<typeof TurnProcess>[0]> = {}) {
  return render(
    <TurnProcess
      segments={SEGMENTS}
      settled={false}
      collapsed={false}
      onToggle={() => undefined}
      labels={LABELS}
      onOpenEntity={() => undefined}
      {...over}
    />,
  );
}

describe('TurnProcess', () => {
  it('plays the process interleaved while the turn streams', () => {
    const { getByText, queryByText } = setup();
    // Prose and work both on screen, each chip carrying its own micro-header.
    expect(getByText('nothing saved for gili t, so here is the plan')).toBeTruthy();
    expect(getByText('searched your saved spots')).toBeTruthy();
    // While it runs, the only "thought for" is the chip's own micro-header
    // (0.5s of work) — the turn-level total header appears on settle.
    expect(getByText('thought for 0.5s')).toBeTruthy();
    expect(queryByText('thought for 12.0s')).toBeNull();
  });

  it('folds everything behind one "thought for" header once it settles', () => {
    const { getByText } = setup({ settled: true, collapsed: true, durationMs: 12_000 });
    // The settled transcript is one line: the total, not the per-chip times.
    expect(getByText('thought for 12.0s')).toBeTruthy();
  });

  it('reports the stop instead of a duration when the user stopped the turn', () => {
    const { getByText } = setup({ settled: true, collapsed: true, stopped: true, durationMs: 3000 });
    expect(getByText('stopped')).toBeTruthy();
  });

  it('expands the same interleaved process when the header is tapped', () => {
    const onToggle = jest.fn();
    const { getByLabelText } = setup({ settled: true, collapsed: true, durationMs: 2000, onToggle });
    fireEvent.press(getByLabelText('thought for 2.0s'));
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('renders nothing for a turn that did no work and said nothing', () => {
    const { toJSON } = setup({ segments: [] });
    expect(toJSON()).toBeNull();
  });

  it('renders commentary prose in the muted tier, not the answer tier', () => {
    const { getByText } = setup();
    const prose = getByText('nothing saved for gili t, so here is the plan');
    // Commentary is a step smaller and softer than the answer (17px/text-muted)
    // so a turn reads as work-then-answer, not one long ramble.
    expect(prose.props.className).toContain('text-[15px]');
    expect(prose.props.className).toContain('text-text-soft');
  });
});
