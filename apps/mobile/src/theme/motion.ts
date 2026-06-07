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
  /** Header live-dot pulse, one direction (reverse loop → 1.4s full cycle). */
  pulse: 700,
  /** Active-node inner-dot pulse, one direction (reverse loop → 1.2s full cycle). */
  pulseFast: 600,
  /** Shimmer half-cycle (= shimmer / 2) for the reverse linear loop. */
  shimmerHalf: 700,
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
 * Chat open/close transition (kebi-chat-mockup). The chat surface fades in and
 * scales up out of the FAB's corner (a container-morph feel), with home held in
 * place behind (no dim, no blur). Close plays the reverse — shrinking and fading
 * back into the button — shorter. The same bezier drives both directions; feed
 * it to `Easing.bezier(...CHAT_REVEAL.bezier)` and pass the duration to
 * `withTiming`. `fromScale` is the size the chat collapses into at the button.
 */
export const CHAT_REVEAL = {
  /** Open: fade + scale up out of the button. */
  openMs: 300,
  /** Close: shrink + fade back into the button (faster than open). */
  closeMs: 220,
  /** Scale the chat starts at (collapsed) and ends at (closed). */
  fromScale: 0.92,
  /** ease-out: quick out of the button, gentle settle (cubic-bezier). */
  bezier: [0.16, 1, 0.3, 1] as const,
} as const;

/**
 * Stagger delay between sequential items (reasoning steps, list entrance).
 * Usage: `withDelay(index * STAGGER_MS, withTiming(...))`
 */
export const STAGGER_MS = 350;

/**
 * Press-feedback className (NativeWind). A single source for the ease-out scale +
 * opacity dip every tappable surface shares, so the values are never retyped
 * per component. Append to a Pressable's `className`:
 *
 *   <Pressable className={`... ${PRESS}`} />
 *
 * ease-out @ 200ms (state-change curve, design-system §16). The mascot breathing
 * loop lives as the `animate-breathe` keyframe in global.css / tailwind.config.js.
 */
export const PRESS =
  'transition-transform duration-200 ease-out active:scale-[0.96] active:opacity-90';

/**
 * App-boot splash timeline (kebi-splash-mockup.html / kebi-splash-dark-mockup.html).
 * Every literal the splash animation needs lives here so none are typed inline in
 * the component (zero-hardcoding). Delays are measured from overlay mount; loop
 * durations are half-cycles consumed by `withRepeat(..., -1, true)` (reverse), so
 * the full cycle is twice the value. Springs reuse `SPRING_CONFIG.entrance`.
 *
 * `holdMs` is how long the fully-revealed splash sits before the fade-out begins;
 * `out.duration` is the fade. Total on-screen ≈ holdMs + out.duration. The
 * reduced-motion path skips the timeline and holds `reducedHoldMs` instead.
 */
export const SPLASH = {
  /** Mascot render size (px) — `.mascot` 140×140 in the mockup. */
  mascotSize: 140,
  /** Radial halo diameter (px) — mascot stage 140 + 20px bleed each side. */
  haloSize: 180,
  /** Mascot entrance: from these resting offsets up to 0 / 1, via a spring. */
  mascot: { delay: 200, fromTranslateY: 8, fromScale: 0.92 },
  /** Halo opacity fade-in. */
  halo: { delay: 300, duration: 900 },
  /** Mascot float loop after entrance: translateY 0 → this → 0 (half-cycle). */
  float: { delay: 1100, halfDuration: 1800, translateY: -4 },
  /**
   * Wordmark typewriter: reveal one character at a time over `duration` (a real
   * keystroke feel, like the mockup's `steps()`), with the cursor blinking on a
   * `cursorBlinkHalf` half-cycle. `cursorHeight` matches the text-title 28px box.
   */
  wordmark: { delay: 900, duration: 700, cursorBlinkHalf: 500, cursorHeight: 28 },
  /** Tagline fade + rise. */
  tagline: { delay: 1700, duration: 500, fromTranslateY: 4 },
  /** Loading dots: container fade-in, then each dot pulses (half-cycle), staggered. */
  dots: { delay: 1900, fadeDuration: 400, pulseHalf: 700, stagger: 180, count: 3 },
  /** Fade + scale-up as the splash hands off to home. */
  out: { duration: 400, scale: 1.04 },
  /** Fully-revealed dwell before the fade-out starts (→ 3.0s total with `out`). */
  holdMs: 2600,
  /** Reduced-motion: skip the timeline, show the rested state this long, then route. */
  reducedHoldMs: 1200,
} as const;

/**
 * Invalid-input shake — the quick horizontal wiggle played on a rejected submit
 * (e.g. the login smart input with ambiguous text). Offsets are fed to
 * `withSequence(...withTiming(offset, { duration: stepMs }))`; the accompanying
 * red border is held separately for AUTH.invalidShakeMs (src/auth/constants.ts).
 */
export const SHAKE = {
  /** Horizontal offsets (px), ending at 0 so the field settles back in place. */
  offsets: [-8, 8, -6, 6, -4, 0],
  /** Per-step duration (ms). */
  stepMs: 50,
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
