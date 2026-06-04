import { useRef, type ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { triggerHaptic } from '../../lib/haptics';
import { useContextMenu } from './context-menu-context';
import type { ContextMenuItem } from './context-menu-types';

/**
 * Wraps any card to give it a long-press context menu (iOS lift + blur). Generic
 * — the consumer supplies the card visual via `renderCard` and its actions via
 * `items`; this owns only the gesture, measurement, and haptic. The same
 * `renderCard` is re-rendered as the lifted clone in the overlay, so the card
 * stays pixel-identical when it rises.
 *
 * Tap handling stays inside `renderCard` (e.g. a Pressable that navigates) — a
 * short tap never crosses the 500ms long-press threshold, so the two coexist.
 */

/** Hold duration before the menu opens (spec: 500ms). */
const LONG_PRESS_MS = 500;
/** Cancel if the finger slides past this — that's a scroll, not a press. */
const MAX_SLIDE_PX = 12;

interface ContextMenuTriggerProps {
  items: ContextMenuItem[];
  /** The card visual; rendered inline and re-rendered as the lifted clone. */
  renderCard: () => ReactNode;
  /** a11y label announced when the menu opens (usually the card's title). */
  accessibilityLabel?: string;
  /** Override the hold threshold (defaults to 500ms). */
  minDurationMs?: number;
}

export function ContextMenuTrigger({
  items,
  renderCard,
  accessibilityLabel,
  minDurationMs = LONG_PRESS_MS,
}: ContextMenuTriggerProps) {
  const ref = useRef<View>(null);
  const { open } = useContextMenu();

  // Runs on the JS thread once the long-press activates: measure the card's
  // window rect, fire the haptic at the moment the menu appears, then open.
  const activate = () => {
    const node = ref.current;
    if (!node) return;
    node.measureInWindow((x, y, width, height) => {
      triggerHaptic('long-press-open');
      open({ rect: { x, y, width, height }, items, renderCard, label: accessibilityLabel });
    });
  };

  const longPress = Gesture.LongPress()
    .minDuration(minDurationMs)
    .maxDistance(MAX_SLIDE_PX)
    .onStart(() => {
      runOnJS(activate)();
    });

  return (
    <GestureDetector gesture={longPress}>
      <View ref={ref} collapsable={false}>
        {renderCard()}
      </View>
    </GestureDetector>
  );
}
