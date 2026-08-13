import { render, fireEvent } from '@testing-library/react-native';
import { ReasoningBlock, type ReasoningBlockStep } from './reasoning-block';

const DONE: ReasoningBlockStep[] = [
  { id: 'a', status: 'done', title: 'searched your stash', summary: '2 bars you liked' },
  { id: 'b', status: 'done', title: 'ranked 9 candidates', summary: 'energy first, then distance' },
];

const RUNNING: ReasoningBlockStep[] = [
  { id: 'a', status: 'done', title: 'picked up the context', summary: 'post-club food, late night' },
  { id: 'b', status: 'active', title: 'scanning late-night spots', summary: null },
];

describe('ReasoningBlock', () => {
  it('renders both tiers (title + detail) per done step, a finished tally, and the done label', () => {
    const { getByText } = render(<ReasoningBlock steps={DONE} done durationMs={1800} />);
    expect(getByText('searched your stash')).toBeTruthy(); // bold action line
    expect(getByText('2 bars you liked')).toBeTruthy(); // muted detail line
    expect(getByText('ranked 9 candidates')).toBeTruthy();
    // Settled, the chip is one line — the work is behind the chevron.
    expect(getByText('thought for 1.8s')).toBeTruthy();
  });

  it('shows "working on it" while running, with the active step title in the body', () => {
    const { getByText } = render(<ReasoningBlock steps={RUNNING} />);
    expect(getByText('working on it')).toBeTruthy(); // header state, not the step title
    expect(getByText('step 1 · streaming…')).toBeTruthy();
    expect(getByText('scanning late-night spots')).toBeTruthy(); // active step's bold line
    expect(getByText('post-club food, late night')).toBeTruthy();
  });

  it('reads "thought for" alone when the chip was never timed', () => {
    const { getByText } = render(<ReasoningBlock steps={DONE} done />);
    expect(getByText('thought for')).toBeTruthy();
  });

  it('shows the live step title while running, passed by the caller', () => {
    // The chip's active label is the agent's current move ("thinking",
    // "connecting the dots") — its varied titles are what label this state.
    const { getByText } = render(<ReasoningBlock steps={RUNNING} runningLabel="connecting the dots" />);
    expect(getByText('connecting the dots')).toBeTruthy();
  });

  it('toggles collapsed state from the header when uncontrolled', () => {
    const onToggle = jest.fn();
    const { getByRole } = render(<ReasoningBlock steps={DONE} done onToggle={onToggle} />);
    fireEvent.press(getByRole('button'));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('falls back to a single line when a step has no title', () => {
    const { getByText } = render(
      <ReasoningBlock steps={[{ id: 'x', status: 'done', summary: 'just one' }]} done />,
    );
    expect(getByText('just one')).toBeTruthy();
  });

  it('counts only the user-visible steps it was handed while streaming', () => {
    // The store drops `debug` frames and routes the agent's talk to prose, so
    // whatever reaches the chip is user-visible work and nothing else.
    const { getByText } = render(<ReasoningBlock steps={RUNNING} />);
    expect(getByText('step 1 · streaming…')).toBeTruthy();
  });
});
