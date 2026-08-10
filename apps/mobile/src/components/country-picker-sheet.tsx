import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnstableNativeVariable } from 'nativewind';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { COUNTRIES, countryFlag, type Country } from '@kebi-app/shared';
import { DURATION, PRESS, SPRING_CONFIG } from '../theme/motion';
import { triggerHaptic } from '../lib/haptics';
import { useTranslation } from '../i18n/context';
import { useToast } from './toast-context';
import { Icon } from './icon';

/**
 * Home-country picker — the about-me screen's country row raises this.
 *
 * A picker rather than a text field on purpose: the gateway validates
 * `home_country` as ISO 3166-1 alpha-2 and 400s anything else, so choosing from
 * this list is what makes the value correct by construction. Flags are derived
 * from the code, never stored (see `countryFlag`).
 *
 * Same sheet language as the edit-name sheet (grabber, scrim, spring up,
 * drag/backdrop to dismiss) and likewise an absolute overlay, not a Modal, so
 * toasts still layer above it. Picking commits immediately — there is no
 * confirm step, because a wrong tap is one more tap to fix.
 */
interface CountryPickerSheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (code: string) => void;
  /** Currently-selected alpha-2, if any — rendered with a check. */
  selected: string | null;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SCRIM_COLOR = 'rgba(15, 13, 10, 0.45)';
const CLOSE_DISTANCE = 90;
const CLOSE_VELOCITY = 800;
const PAN_ACTIVATE_Y = 10;
/** Sheet height as a share of the screen — tall enough that search is worth it. */
const SHEET_HEIGHT_RATIO = 0.78;
const ROW_HEIGHT = 52;

export function CountryPickerSheet({
  open,
  onClose,
  onSelect,
  selected,
}: CountryPickerSheetProps) {
  const { t } = useTranslation();
  const { reserveTopAnchor } = useToast();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const softColor = useUnstableNativeVariable('--text-soft') ?? undefined;

  const [mounted, setMounted] = useState(open);
  const [query, setQuery] = useState('');
  const scrim = useSharedValue(0);
  const translateY = useSharedValue(height);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    return reserveTopAnchor();
  }, [mounted, reserveTopAnchor]);

  // Reset the search each time it opens — a stale query would hide the list.
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  useEffect(() => {
    if (mounted && open) {
      scrim.value = withTiming(1, { duration: DURATION.stateChangeFast });
      translateY.value = withSpring(0, SPRING_CONFIG.sheet);
    }
  }, [mounted, open, scrim, translateY]);

  useEffect(() => {
    if (!open && mounted) {
      scrim.value = withTiming(0, { duration: DURATION.stateChangeFast });
      translateY.value = withTiming(height, { duration: DURATION.stateChange }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [open, mounted, scrim, translateY, height]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const pan = Gesture.Pan()
    .activeOffsetY(PAN_ACTIVATE_Y)
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > CLOSE_DISTANCE || e.velocityY > CLOSE_VELOCITY) {
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, SPRING_CONFIG.sheet);
      }
    });

  // Matches on name or code, so "AE" and "emirates" both find the same row.
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.code.toLowerCase().startsWith(needle),
    );
  }, [query]);

  if (!mounted) return null;

  const handleSelect = (code: string) => {
    triggerHaptic('save-sheet-confirm');
    onSelect(code);
  };

  const renderCountry = ({ item }: { item: Country }) => {
    const isSelected = item.code === selected;
    return (
      <Pressable
        onPress={() => handleSelect(item.code)}
        accessibilityRole="button"
        accessibilityLabel={item.name}
        accessibilityState={{ selected: isSelected }}
        className={`h-[52px] flex-row items-center gap-3 rounded-medium px-2 ${PRESS}`}
      >
        <Text className="text-[22px]">{countryFlag(item.code)}</Text>
        <Text className="flex-1 text-body text-text" numberOfLines={1}>
          {item.name}
        </Text>
        {isSelected ? (
          <Icon name="check" size={16} className="text-text" />
        ) : (
          <Text className="text-small font-semibold text-text-soft">{item.code}</Text>
        )}
      </Pressable>
    );
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <AnimatedPressable
        style={[StyleSheet.absoluteFill, scrimStyle, { backgroundColor: SCRIM_COLOR }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      />

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            { height: height * SHEET_HEIGHT_RATIO, paddingBottom: insets.bottom + 8 },
          ]}
          className="bg-bg"
        >
          <View className="mx-auto mb-0.5 h-1 w-9 rounded-full bg-surface-2" />

          <Text className="px-1 text-subtitle font-bold text-text">{t('aboutYou.countryTitle')}</Text>

          <View className="rounded-large bg-surface px-3.5 py-3">
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('aboutYou.countrySearch')}
              placeholderTextColor={softColor}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              className="p-0 text-[16px] leading-6 text-text"
            />
          </View>

          <FlatList
            data={results}
            keyExtractor={(c) => c.code}
            renderItem={renderCountry}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            getItemLayout={(_, index) => ({
              length: ROW_HEIGHT,
              offset: ROW_HEIGHT * index,
              index,
            })}
            ListEmptyComponent={
              <Text className="px-2 py-6 text-center text-small text-text-muted">
                {t('aboutYou.countryEmpty')}
              </Text>
            }
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 24,
  },
});
