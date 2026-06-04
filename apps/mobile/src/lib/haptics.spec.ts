/**
 * Unit tests for the haptics utility. `expo-haptics` and the `react-native`
 * AppState / AccessibilityInfo surfaces are mocked so we can assert the guard
 * chain (backgrounded, reduced-motion, no-stacking) without a device.
 */

// jest.mock factories may only reference vars prefixed with `mock`.
const mockImpactAsync = jest.fn(() => Promise.resolve());
const mockNotificationAsync = jest.fn(() => Promise.resolve());
const mockSelectionAsync = jest.fn(() => Promise.resolve());

jest.mock('expo-haptics', () => ({
  impactAsync: mockImpactAsync,
  notificationAsync: mockNotificationAsync,
  selectionAsync: mockSelectionAsync,
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Rigid: 'rigid', Soft: 'soft' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

let mockAppState = 'active';
let mockReduceMotion = false;

jest.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return mockAppState;
    },
  },
  AccessibilityInfo: {
    isReduceMotionEnabled: () => Promise.resolve(mockReduceMotion),
    addEventListener: () => ({ remove: jest.fn() }),
  },
}));

type TriggerHaptic = (event: string) => void;

/** Re-import the module fresh so its cached reduce-motion flag reflects the current mock. */
async function loadTrigger(): Promise<TriggerHaptic> {
  jest.resetModules();
  const mod = require('./haptics') as { triggerHaptic: TriggerHaptic };
  // flush the isReduceMotionEnabled().then(...) microtask that sets the cache
  await Promise.resolve();
  await Promise.resolve();
  return mod.triggerHaptic;
}

describe('triggerHaptic', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1_000_000); // large base so the initial lastFiredAt (0) never collides
    mockAppState = 'active';
    mockReduceMotion = false;
    mockImpactAsync.mockClear();
    mockNotificationAsync.mockClear();
    mockSelectionAsync.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires the mapped family/style for each event', async () => {
    const trigger = await loadTrigger();

    trigger('fab-tap');
    expect(mockImpactAsync).toHaveBeenLastCalledWith('soft');

    jest.advanceTimersByTime(300);
    trigger('save-it');
    expect(mockImpactAsync).toHaveBeenLastCalledWith('light');

    jest.advanceTimersByTime(300);
    trigger('library-swipe-threshold');
    expect(mockImpactAsync).toHaveBeenLastCalledWith('medium');

    jest.advanceTimersByTime(300);
    trigger('good-pick');
    expect(mockNotificationAsync).toHaveBeenLastCalledWith('success');

    jest.advanceTimersByTime(300);
    trigger('confirm-delete');
    expect(mockNotificationAsync).toHaveBeenLastCalledWith('warning');

    jest.advanceTimersByTime(300);
    trigger('not-it');
    expect(mockSelectionAsync).toHaveBeenCalledTimes(1);
  });

  it('no-ops when the app is backgrounded', async () => {
    mockAppState = 'background';
    const trigger = await loadTrigger();

    trigger('fab-tap');

    expect(mockImpactAsync).not.toHaveBeenCalled();
  });

  it('no-ops when reduced motion is enabled', async () => {
    mockReduceMotion = true;
    const trigger = await loadTrigger();

    trigger('fab-tap');

    expect(mockImpactAsync).not.toHaveBeenCalled();
  });

  it('suppresses a second haptic within the 200ms stack window', async () => {
    const trigger = await loadTrigger();

    trigger('fab-tap'); // fires
    jest.advanceTimersByTime(50);
    trigger('good-pick'); // suppressed (within window)

    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
    expect(mockNotificationAsync).not.toHaveBeenCalled();

    jest.advanceTimersByTime(200); // window cleared
    trigger('good-pick'); // fires
    expect(mockNotificationAsync).toHaveBeenCalledTimes(1);
  });
});
