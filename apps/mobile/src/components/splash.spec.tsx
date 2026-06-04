import { render, act } from '@testing-library/react-native';
import { Splash } from './splash';
import { SPLASH } from '../theme/motion';

// useReducedMotion is mocked per-test so we can exercise both the full timeline
// and the short-circuit path without touching the device accessibility API.
const mockReducedMotion = jest.fn<boolean, []>(() => false);
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated/mock');
  return { ...actual, useReducedMotion: () => mockReducedMotion() };
});

describe('Splash', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReducedMotion.mockReturnValue(false);
  });
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it('types out the brand wordmark and renders the tagline', () => {
    const { getByText, queryByText } = render(<Splash onDone={jest.fn()} />);
    // Tagline is in the tree from the start (only its opacity animates).
    expect(getByText('your place guy')).toBeTruthy();
    // Wordmark types in character by character — not yet complete at mount.
    expect(queryByText('Kebi')).toBeNull();
    act(() => jest.advanceTimersByTime(SPLASH.wordmark.delay + SPLASH.wordmark.duration + 1));
    expect(getByText('Kebi')).toBeTruthy();
  });

  it('calls onDone once after the full timeline (hold + fade-out)', () => {
    const onDone = jest.fn();
    render(<Splash onDone={onDone} />);

    // Before the dwell elapses, the splash is still up.
    act(() => jest.advanceTimersByTime(SPLASH.holdMs - 1));
    expect(onDone).not.toHaveBeenCalled();

    // After the dwell + fade-out, it hands off exactly once.
    act(() => jest.advanceTimersByTime(SPLASH.out.duration + 1));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('short-circuits under reduce-motion (routes after the shorter hold)', () => {
    mockReducedMotion.mockReturnValue(true);
    const onDone = jest.fn();
    render(<Splash onDone={onDone} />);

    // It does not wait the full timeline — the reduced hold is much shorter.
    act(() => jest.advanceTimersByTime(SPLASH.reducedHoldMs + SPLASH.out.duration + 1));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
