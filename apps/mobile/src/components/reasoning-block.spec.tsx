import { render, fireEvent } from '@testing-library/react-native';
import { ReasoningBlock, type ReasoningBlockStep } from './reasoning-block';

const DONE: ReasoningBlockStep[] = [
  { id: 'a', status: 'done', summary: 'searched your stash' },
  { id: 'b', status: 'done', summary: 'ranked 9 candidates' },
];

const RUNNING: ReasoningBlockStep[] = [
  { id: 'a', status: 'done', summary: 'picked up the context' },
  { id: 'b', status: 'active', summary: null },
];

describe('ReasoningBlock', () => {
  it('renders each done step narration and a finished meta tally', () => {
    const { getByText } = render(<ReasoningBlock steps={DONE} done durationMs={1800} />);
    expect(getByText('searched your stash')).toBeTruthy();
    expect(getByText('ranked 9 candidates')).toBeTruthy();
    expect(getByText('2 steps · 1.8s')).toBeTruthy();
  });

  it('shows a live "step N · streaming…" meta and the default label while running', () => {
    const { getByText, queryByText } = render(<ReasoningBlock steps={RUNNING} />);
    expect(getByText('thinking')).toBeTruthy();
    expect(getByText('step 1 · streaming…')).toBeTruthy();
    // The active step carries no summary (renders a skeleton, no narration text).
    expect(queryByText('picked up the context')).toBeTruthy();
  });

  it('toggles collapsed state from the header when uncontrolled', () => {
    const onToggle = jest.fn();
    const { getByRole } = render(<ReasoningBlock steps={DONE} done onToggle={onToggle} />);
    fireEvent.press(getByRole('button'));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('singularises the step count', () => {
    const { getByText } = render(
      <ReasoningBlock steps={[{ id: 'x', status: 'done', summary: 'just one' }]} done />,
    );
    expect(getByText('1 step')).toBeTruthy();
  });
});
