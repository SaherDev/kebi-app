import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnstableNativeVariable } from 'nativewind';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from './icon';
import { IconButton } from './icon-button';
import { CHAT_REVEAL } from '../theme/motion';
import { useTranslation } from '../i18n/context';

/**
 * Library top bar (kebi-library-mockup.html `.top-bar`): pinned above the scroll.
 * Default shows the back button and a pill with search + save triggers. Tapping
 * search reveals the full-width search input by scaling + fading it out of the
 * 🔍 button's corner (transform-origin top-right) — the same reveal the kebi
 * chat uses (CHAT_REVEAL). Clearing an empty field plays the reverse and
 * collapses back into the corner.
 */

interface LibraryTopBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSave: () => void;
}

const REVEAL_EASING = Easing.bezier(...CHAT_REVEAL.bezier);

export function LibraryTopBar({ query, onQueryChange, onSave }: LibraryTopBarProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mutedColor = useUnstableNativeVariable('--text-muted') ?? undefined;
  const [searching, setSearching] = useState(false);
  const progress = useSharedValue(0);

  const openSearch = () => {
    setSearching(true);
    progress.value = withTiming(1, { duration: CHAT_REVEAL.openMs, easing: REVEAL_EASING });
  };

  // Reverse the reveal, then unmount the input once it has shrunk back in.
  const collapse = () => {
    onQueryChange('');
    progress.value = withTiming(
      0,
      { duration: CHAT_REVEAL.closeMs, easing: REVEAL_EASING },
      (finished) => {
        if (finished) runOnJS(setSearching)(false);
      },
    );
  };

  const revealStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [CHAT_REVEAL.fromScale, 1]) }],
  }));

  return (
    <View className="flex-row items-center px-4 pb-3" style={{ paddingTop: insets.top + 12 }}>
      {searching ? (
        <Animated.View className="flex-1" style={[revealStyle, { transformOrigin: '100% 0%' }]}>
          <View className="h-11 flex-row items-center gap-2.5 rounded-full bg-surface ps-4 pe-1.5">
            <Icon name="search" size={18} className="text-text-soft" />
            <TextInput
              autoFocus
              value={query}
              onChangeText={onQueryChange}
              placeholder={t('library.searchPlaceholder')}
              placeholderTextColor={mutedColor}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              // Font-size only (no text-body lineHeight, which makes iOS render
              // the glyph low) + a definite height so the text centers on the
              // same line as the search/close icons.
              includeFontPadding={false}
              textAlignVertical="center"
              className="h-11 flex-1 p-0 text-[15px] text-text"
            />
            <IconButton
              icon="close"
              label={t('common.close')}
              variant="pill"
              tone="text-text-muted"
              onPress={() => (query ? onQueryChange('') : collapse())}
            />
          </View>
        </Animated.View>
      ) : (
        <>
          <IconButton icon="back" label={t('common.back')} onPress={() => router.back()} />
          <View className="ms-auto flex-row items-center rounded-full bg-surface px-1">
            <IconButton
              icon="search"
              label={t('common.search')}
              variant="pill"
              onPress={openSearch}
            />
            <IconButton icon="share-in" label={t('nav.savePlace')} variant="pill" onPress={onSave} />
          </View>
        </>
      )}
    </View>
  );
}
