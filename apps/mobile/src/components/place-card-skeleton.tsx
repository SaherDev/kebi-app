import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { DURATION } from '../theme/motion';

/**
 * Place-card skeleton (kebi-chat-mockup.html `.place-skeleton`) — the shimmer
 * stand-in shown under a kebi turn while a tool result has arrived but the real
 * card isn't built yet. Task 2 replaces this with the rendered recommendation;
 * for now it signals "places are coming" without a spinner (design-system §Loading).
 *
 * Matches the place-card silhouette: an avatar disc + a title bar in the header,
 * then three body bars. Linear shimmer is the only linear-paced motion (1.4s),
 * shared with the reasoning block.
 */
export function PlaceCardSkeleton() {
  return (
    <View className="gap-2.5 rounded-large bg-surface p-3.5" accessibilityLabel="loading places">
      <View className="flex-row items-center gap-2.5">
        <Bar className="h-7 w-7 rounded-small" />
        <Bar className="h-3.5 w-1/2 rounded" />
      </View>
      <Bar className="h-3 w-[90%] rounded" />
      <Bar className="h-3 w-[70%] rounded" />
      <Bar className="h-3 w-[35%] rounded" />
    </View>
  );
}

/** A single shimmering bar; `className` sets its size/shape via tokens. */
function Bar({ className }: { className: string }) {
  const sh = useSharedValue(0);
  useEffect(() => {
    sh.value = withRepeat(
      withTiming(1, { duration: DURATION.shimmerHalf, easing: Easing.linear }),
      -1,
      true,
    );
    return () => cancelAnimation(sh);
  }, [sh]);
  const style = useAnimatedStyle(() => ({ opacity: 0.5 + sh.value * 0.5 }));
  return <Animated.View style={style} className={`bg-surface-2 ${className}`} />;
}
