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
    expect(getByText('2 steps · 1.8s')).toBeTruthy();
    expect(getByText('got it')).toBeTruthy(); // header switches to the done state
  });

  it('shows "working on it" while running, with the active step title in the body', () => {
    const { getByText } = render(<ReasoningBlock steps={RUNNING} />);
    expect(getByText('working on it')).toBeTruthy(); // header state, not the step title
    expect(getByText('step 1 · streaming…')).toBeTruthy();
    expect(getByText('scanning late-night spots')).toBeTruthy(); // active step's bold line
    expect(getByText('post-club food, late night')).toBeTruthy();
  });

  it('renders live narration on an active step instead of the shimmer', () => {
    const { getByText } = render(
      <ReasoningBlock
        steps={[{ id: 'b', status: 'active', title: 'thinking', narration: "nothing saved, so let's", summary: null }]}
      />,
    );
    expect(getByText("nothing saved, so let's")).toBeTruthy();
  });

  it("the done frame's summary supersedes narration left on the step", () => {
    const { getByText, queryByText } = render(
      <ReasoningBlock
        steps={[{ id: 'b', status: 'done', title: 'thinking', narration: 'half-typed thought', summary: 'checked your saves' }]}
        done
      />,
    );
    expect(getByText('checked your saves')).toBeTruthy();
    expect(queryByText('half-typed thought')).toBeNull();
  });

  it('keeps what typed out on a step interrupted mid-thought', () => {
    // Stream died while this row was still typing — whatever rendered stays.
    const { getByText } = render(
      <ReasoningBlock
        steps={[{ id: 'b', status: 'active', title: 'thinking', narration: 'looking at what', summary: null }]}
        done
      />,
    );
    expect(getByText('looking at what')).toBeTruthy();
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
