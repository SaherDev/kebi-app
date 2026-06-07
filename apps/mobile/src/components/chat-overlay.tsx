import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ChatScreen } from './chat-screen';
import { FAB_EDGE_INSET, FAB_SIZE } from './kebi-fab';
import { CHAT_REVEAL } from '../theme/motion';

const REVEAL_EASING = Easing.bezier(...CHAT_REVEAL.bezier);

interface ChatOverlayProps {
  /** Whether the chat should be shown. Toggling drives the transition both ways. */
  open: boolean;
  /** Close request from the header X — flips `open` false via the provider. */
  onClose: () => void;
}

/**
 * Open/close host for the chat surface. The full-screen chat fades in and scales
 * up out of the FAB's corner (transform origin pinned to the button), so it
 * appears to grow from the button; close shrinks and fades it back in. Home
 * stays mounted behind — the overlay is transparent until it fades in, with no
 * dim or blur. Open is 300ms, close 220ms, both ease-out. The overlay unmounts
 * itself once the collapse finishes, so the chat fully disappears into the button.
 */
export function ChatOverlay({ open, onClose }: ChatOverlayProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  // Keep the overlay mounted through the closing animation; unmount only after
  // the chat has collapsed back into the button.
  const [mounted, setMounted] = useState(open);
  const progress = useSharedValue(0);

  // The FAB's center, in screen coordinates — the point the chat scales out of.
  // Derived from the same geometry the button lays itself out with (no async
  // measure, so the transition can't race the button's layout).
  const origin = useMemo(
    () => ({
      x: width - FAB_EDGE_INSET - FAB_SIZE / 2,
      y: height - insets.bottom - FAB_SIZE / 2,
    }),
    [width, height, insets.bottom],
  );

  useEffect(() => {
    if (open) {
      setMounted(true);
      progress.value = withTiming(1, {
        duration: reducedMotion ? 0 : CHAT_REVEAL.openMs,
        easing: REVEAL_EASING,
      });
    } else if (mounted) {
      progress.value = withTiming(
        0,
        { duration: reducedMotion ? 0 : CHAT_REVEAL.closeMs, easing: REVEAL_EASING },
        (finished) => {
          if (finished) runOnJS(setMounted)(false);
        },
      );
    }
    // `mounted` is intentionally omitted: it transitions 0→1 synchronously with
    // `open` and must not re-trigger the animation on its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [CHAT_REVEAL.fromScale, 1]) }],
  }));

  if (!mounted) return null;

  return (
    <Animated.View
      // transformOrigin pins the scale pivot to the button corner so the chat
      // grows out of / shrinks into the FAB rather than the screen center.
      style={[StyleSheet.absoluteFill, { transformOrigin: [origin.x, origin.y, 0] }, animatedStyle]}
      // Swallow taps only while shown; during the collapse, let them through.
      pointerEvents={open ? 'auto' : 'none'}
    >
      <ChatScreen onClose={onClose} />
    </Animated.View>
  );
}
