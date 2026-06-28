import { render, act } from '@testing-library/react-native';
import { TypewriterText } from './typewriter-text';
import { GREETING_TYPE } from '../theme/motion';

// Mirror the splash spec: drive reduce-motion per-test so both the typed
// timeline and the immediate-reveal path are exercised without the device API.
const mockReducedMotion = jest.fn<boolean, []>(() => false);
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated/mock');
  return { ...actual, useReducedMotion: () => mockReducedMotion() };
});

const PHRASE = "it's late, drunk food?";

describe('TypewriterText', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReducedMotion.mockReturnValue(false);
  });
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it('reveals the text one character at a time', () => {
    const { queryByText, getByText } = render(<TypewriterText text={PHRASE} />);
    // Not yet fully typed at mount (only the caret is on screen).
    expect(queryByText(PHRASE)).toBeNull();

    act(() => jest.advanceTimersByTime(PHRASE.length * GREETING_TYPE.perCharMs + 1));
    // Once done, the caret is dropped, so the node text is exactly the phrase.
    expect(getByText(PHRASE)).toBeTruthy();
  });

  it('replays from the start when the text changes', () => {
    const { rerender, queryByText } = render(<TypewriterText text="morning" />);
    act(() => jest.advanceTimersByTime('morning'.length * GREETING_TYPE.perCharMs + 1));
    expect(queryByText('morning')).toBeTruthy();

    rerender(<TypewriterText text={PHRASE} />);
    // New text starts typing from scratch — not complete immediately.
    expect(queryByText(PHRASE)).toBeNull();
    act(() => jest.advanceTimersByTime(PHRASE.length * GREETING_TYPE.perCharMs + 1));
    expect(queryByText(PHRASE)).toBeTruthy();
  });

  it('shows the whole line immediately under reduce-motion', () => {
    mockReducedMotion.mockReturnValue(true);
    const { getByText } = render(<TypewriterText text={PHRASE} />);
    // No timers advanced — reduce-motion reveals everything at mount, no caret.
    expect(getByText(PHRASE)).toBeTruthy();
  });
});
