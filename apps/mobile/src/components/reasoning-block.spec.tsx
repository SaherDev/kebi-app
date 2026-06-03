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
  it('renders both tiers (title + detail) per done step and a finished meta tally', () => {
    const { getByText } = render(<ReasoningBlock steps={DONE} done durationMs={1800} />);
    expect(getByText('searched your stash')).toBeTruthy(); // bold action line
    expect(getByText('2 bars you liked')).toBeTruthy(); // muted detail line
    expect(getByText('ranked 9 candidates')).toBeTruthy();
    expect(getByText('2 steps · 1.8s')).toBeTruthy();
  });

  it('shows a live meta and the active step title while its detail is still streaming', () => {
    const { getByText, queryByText } = render(<ReasoningBlock steps={RUNNING} />);
    expect(getByText('thinking')).toBeTruthy();
    expect(getByText('step 1 · streaming…')).toBeTruthy();
    // The active step keeps its title even though its detail is a skeleton.
    expect(getByText('scanning late-night spots')).toBeTruthy();
    expect(queryByText('post-club food, late night')).toBeTruthy();
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
    expect(getByText('1 step')).toBeTruthy();
  });
});
