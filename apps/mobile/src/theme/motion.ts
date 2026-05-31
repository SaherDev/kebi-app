/**
 * Motion / animation token constants for react-native-reanimated (Track B+).
 *
 * Tailwind `transition`/`duration`/`ease` utilities are no-ops in React Native;
 * animation values must be JS constants consumed by `withTiming`, `withSpring`,
 * `withDelay`, and `Easing` from react-native-reanimated.
 *
 * Source: docs/kebi-app-design-system/kebi-tokens-mockup.html §16 (motion).
 */

/**
 * Duration in milliseconds for each motion style.
 *
 * Usage: `withTiming(toValue, { duration: DURATION.stateChange })`
 */
export const DURATION = {
  /** Most state changes: 200–280ms. Use 240ms as the midpoint default. */
  stateChange: 240,
  /** Short state change (eg. pill swap): 200ms */
  stateChangeFast: 200,
  /** Longer state change (eg. sheet height shift): 280ms */
  stateChangeSlow: 280,
  /** Symmetric open/close (ease-in-out): 240ms */
  symmetric: 240,
  /** Entrance / spring animations: 280ms+ (cubic spring) */
  entrance: 300,
  /** Skeleton shimmer (linear loop): 1400ms */
  shimmer: 1400,
} as const;

/**
 * Easing curves.
 *
 * Import `Easing` from `react-native-reanimated` and pass these as the
 * `easing` option to `withTiming`:
 *
 *   import Easing from 'react-native-reanimated';
 *   withTiming(val, { duration: DURATION.stateChange, easing: EASING.easeOut })
 *
 * For spring entrances use `withSpring` with SPRING_CONFIG (below) — not withTiming.
 */
export const EASING = {
  /** Most UI transitions (state changes, list item mounts). */
  easeOut: 'easeOut' as const,
  /** Symmetric moves (sheet open/close, drawer). */
  easeInOut: 'easeInOut' as const,
  /** Skeleton shimmer loop — linear pacing only. */
  linear: 'linear' as const,
} as const;

/**
 * Spring config matching cubic-bezier(0.34, 1.56, 0.64, 1) @ 280–300ms.
 *
 * Used for entrances and pick-ups: save sheet, AI button tap, toast arrival.
 * Pass as the config object to `withSpring`:
 *
 *   withSpring(toValue, SPRING_CONFIG.entrance)
 */
export const SPRING_CONFIG = {
  entrance: {
    // Tuned to approximate cubic-bezier(0.34, 1.56, 0.64, 1) with slight overshoot.
    stiffness:  260,
    damping:    20,
    mass:       1,
    overshootClamping: false,
  },
  /** Save-sheet bottom-sheet spring (slightly less bouncy). */
  sheet: {
    stiffness:  240,
    damping:    22,
    mass:       1,
    overshootClamping: false,
  },
} as const;

/**
 * Stagger delay between sequential items (reasoning steps, list entrance).
 * Usage: `withDelay(index * STAGGER_MS, withTiming(...))`
 */
export const STAGGER_MS = 350;

/**
 * Mascot breathing animation parameters (2.4s ease-in-out, scale 1→1.02 + -2px translateY).
 * Usage: `withRepeat(withTiming(1.02, { duration: MASCOT_BREATHE.duration, easing: ... }), -1, true)`
 */
export const MASCOT_BREATHE = {
  scaleMax:     1.02,
  translateYPx: -2,
  duration:     2400,
} as const;

/**
 * Toast auto-dismiss durations.
 */
export const TOAST_DISMISS_MS = {
  /** No-action toast: 3 seconds. */
  simple: 3000,
  /** Toast with undo/retry action: 5 seconds. */
  withAction: 5000,
} as const;
