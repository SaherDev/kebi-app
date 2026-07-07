/**
 * Haptic feedback — the single place that touches `expo-haptics`.
 *
 * Every haptic in the app comes from the required map in the design system
 * (docs/kebi-app-design-system/design-system.md → Behavior → Haptics) and
 * ADR-043. Don't call `expo-haptics` directly anywhere else, and don't invent
 * a new trigger at the call site — add a row to the map (and to `HAPTIC_MAP`
 * below) first.
 *
 * The rule: vibrate when something the user *did* registered, never for
 * incoming or passive events. Silent triggers (navigation, toast-appears,
 * streaming, background removals) have no entry here — there's nothing to call.
 */
import { AccessibilityInfo, AppState } from 'react-native';
import * as Haptics from 'expo-haptics';

const { ImpactFeedbackStyle, NotificationFeedbackType } = Haptics;

/**
 * Every user-initiated trigger that fires a haptic. Mirrors the design-system
 * map 1:1. `Impact.Heavy` is intentionally unreachable — no entry produces it.
 */
export type HapticEvent =
  | 'fab-tap' // Tap Kebi AI button (floating mascot)
  | 'good-pick' // "good pick" on chat place card
  | 'save-it' // "save it" on chat place card
  | 'not-it' // "not it" on chat place card
  | 'save-sheet-confirm' // Save button in save sheet
  | 'long-press-open' // Long-press a card → context menu lifts (menu appears)
  | 'confirm-delete' // Tap red action to confirm delete
  | 'forget-place' // "forget this place" in overflow menu
  | 'toast-undo' // Undo on a toast
  | 'pull-refresh' // Pull-to-refresh past threshold
  | 'filter-chip' // Filter chip selected
  | 'theme-toggle' // Theme toggle (light ↔ dark)
  | 'stop-stream' // Stop a streaming chat response
  | 'swap-select'; // Promote a "swap to" alternative to the recommendation

/**
 * Trigger → concrete `expo-haptics` call. The one source of truth in code for
 * which family/style each event uses; keep it identical to the doc table.
 */
const HAPTIC_MAP: Record<HapticEvent, () => Promise<void>> = {
  'fab-tap': () => Haptics.impactAsync(ImpactFeedbackStyle.Soft),
  'good-pick': () => Haptics.notificationAsync(NotificationFeedbackType.Success),
  'save-it': () => Haptics.impactAsync(ImpactFeedbackStyle.Light),
  'not-it': () => Haptics.selectionAsync(),
  'save-sheet-confirm': () => Haptics.notificationAsync(NotificationFeedbackType.Success),
  'long-press-open': () => Haptics.impactAsync(ImpactFeedbackStyle.Medium),
  'confirm-delete': () => Haptics.notificationAsync(NotificationFeedbackType.Warning),
  'forget-place': () => Haptics.notificationAsync(NotificationFeedbackType.Warning),
  'toast-undo': () => Haptics.impactAsync(ImpactFeedbackStyle.Light),
  'pull-refresh': () => Haptics.impactAsync(ImpactFeedbackStyle.Light),
  'filter-chip': () => Haptics.selectionAsync(),
  'theme-toggle': () => Haptics.impactAsync(ImpactFeedbackStyle.Soft),
  'stop-stream': () => Haptics.impactAsync(ImpactFeedbackStyle.Light),
  'swap-select': () => Haptics.selectionAsync(),
};

/**
 * No-stacking window. If a haptic already fired within this many ms, the next
 * one is suppressed. This is an immediate first-wins simplification of the
 * design-system's "most important wins" — buffering to pick a winner would add
 * latency, and haptics must feel instant. Collisions are rare in practice.
 */
const STACK_WINDOW_MS = 200;

let lastFiredAt = 0;

/**
 * Reduced-motion is read once at module load and kept current via a listener,
 * so the per-tap path stays synchronous (no await on every press).
 */
let reduceMotionEnabled = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((enabled) => {
    reduceMotionEnabled = enabled;
  })
  .catch(() => {
    // If the query fails, default to allowing haptics.
  });
AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
  reduceMotionEnabled = enabled;
});

/**
 * Fire the haptic mapped to `event`, honoring the design-system guards:
 * silent when the app is backgrounded, silent when reduced motion is enabled,
 * and never within {@link STACK_WINDOW_MS} of a previous haptic. Fire-and-forget
 * and never throws — a device with no taptic engine (or the simulator) is a
 * silent no-op, not an error in a tap handler.
 */
export function triggerHaptic(event: HapticEvent): void {
  if (AppState.currentState !== 'active') return;
  if (reduceMotionEnabled) return;

  const now = Date.now();
  if (now - lastFiredAt < STACK_WINDOW_MS) return;
  lastFiredAt = now;

  HAPTIC_MAP[event]().catch(() => {
    // No taptic engine / unsupported device — swallow.
  });
}
