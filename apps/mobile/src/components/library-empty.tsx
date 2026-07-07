import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Mascot } from './mascot';
import { useTranslation } from '../i18n/context';

/**
 * Library empty state (kebi-library-empty-mockup.html): the eyebrow up top, then
 * a gently breathing mascot, "your stash is empty", and a cue pointing at the
 * save bookmark in the top bar. The save trigger already lives in the top bar —
 * no extra button here.
 */
export function LibraryEmpty() {
  const { t } = useTranslation();
  const scale = useSharedValue(1);

  useEffect(() => {
    // Subtle breathe (mockup `@keyframes breathe`): 1 → 1.045, ease in-out, loop.
    scale.value = withRepeat(
      withTiming(1.045, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [scale]);

  const breathe = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View className="flex-1 px-6 pt-2">
      <Text className="text-eyebrow font-semibold uppercase text-text-soft">
        {t('library.eyebrow')}
      </Text>
      <View className="flex-1 items-center justify-center gap-[18px] pb-24">
        <Animated.View style={breathe}>
          <Mascot size={88} />
        </Animated.View>
        <Text className="text-center text-[26px] font-bold text-text">
          {t('library.empty.title')}
        </Text>
        <Text className="max-w-[268px] text-center text-body leading-relaxed text-text-muted">
          {t('library.empty.hint')}
        </Text>
      </View>
    </View>
  );
}
