import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnstableNativeVariable } from 'nativewind';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { DURATION, PRESS, SPRING_CONFIG } from '../theme/motion';
import { triggerHaptic } from '../lib/haptics';
import { useTranslation } from '../i18n/context';
import { useToast } from './toast-context';

/**
 * Curate sheet — where an insider writes what they know
 * (kebi-curate-options.html §2, option b). Shares the save/note-sheet language
 * (grabber, scrim, spring up, drag/backdrop to dismiss) with three deliberate
 * differences, each a settled decision:
 *
 * - **It opens tall.** This sheet lives its whole life with the keyboard up, so
 *   a save-sheet-height sheet would leave ~3 visible lines of your own
 *   paragraph. The prose field takes all the slack.
 * - **The anchor sits above the title**, so the first thing you read is what you
 *   are writing about, then the question.
 * - **The hint says the write is public.** This is the last moment before a
 *   global write, and the doors said it too — the one repetition worth keeping.
 *
 * Presentational: the draft is owned by the provider (it survives dismissal, per
 * anchor), and submitting hands the trimmed text up. There is no "sending"
 * state — the host closes immediately and toasts (§2: optimistic submit).
 */
export interface CurateAnchorView {
  emoji: string;
  /** Place or area name — what the prose is about. */
  name: string;
  /** Secondary line, e.g. "nezu, tokyo". */
  context?: string;
}

interface CurateSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
  /** Live draft text, owned by the host so it survives a dismissal. */
  value: string;
  onChangeText: (text: string) => void;
  /** What the prose is pinned to; `null` renders the unanchored state. */
  anchor: CurateAnchorView | null;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SCRIM_COLOR = 'rgba(15, 13, 10, 0.45)';
const CLOSE_DISTANCE = 90;
const CLOSE_VELOCITY = 800;
const PAN_ACTIVATE_Y = 10;
/** Fraction of the screen the sheet occupies — tall, because the keyboard is up. */
const SHEET_HEIGHT_RATIO = 0.72;

export function CurateSheet({
  open,
  onClose,
  onSubmit,
  value,
  onChangeText,
  anchor,
}: CurateSheetProps) {
  const { t } = useTranslation();
  const { reserveTopAnchor } = useToast();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const softColor = useUnstableNativeVariable('--text-soft') ?? undefined;

  const [mounted, setMounted] = useState(open);
  const scrim = useSharedValue(0);
  const translateY = useSharedValue(height);
  const keyboard = useAnimatedKeyboard();

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  // Toasts anchor to the top while this sheet is up, so a confirmation is not
  // hidden behind it.
  useEffect(() => {
    if (!mounted) return;
    return reserveTopAnchor();
  }, [mounted, reserveTopAnchor]);

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
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value - keyboard.height.value }],
  }));

  const pan = Gesture.Pan()
    .activeOffsetY(PAN_ACTIVATE_Y)
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      // Dismissing is free: the draft is kept, so there is nothing to confirm.
      if (e.translationY > CLOSE_DISTANCE || e.velocityY > CLOSE_VELOCITY) {
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, SPRING_CONFIG.sheet);
      }
    });

  if (!mounted) return null;

  const filled = value.trim().length > 0;

  const handleSubmit = () => {
    if (!filled) return;
    triggerHaptic('save-sheet-confirm');
    onSubmit(value.trim());
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
            { paddingBottom: insets.bottom + 12, height: height * SHEET_HEIGHT_RATIO },
          ]}
          className="bg-bg"
        >
          <View className="mx-auto mb-0.5 h-1 w-9 rounded-full bg-surface-2" />

          {/* Anchor first: what this is about, before what to write. */}
          <View className="flex-row items-center gap-2.5 rounded-card bg-surface px-2.5 py-2">
            <View className="size-7 items-center justify-center rounded-small bg-surface-2">
              <Text style={{ fontSize: 14, lineHeight: 18 }}>{anchor?.emoji ?? '📍'}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-eyebrow font-semibold uppercase text-text-soft">
                {t('curate.about')}
              </Text>
              <Text
                numberOfLines={1}
                className={`text-small font-semibold ${anchor ? 'text-text' : 'text-text-soft'}`}
              >
                {anchor
                  ? anchor.context
                    ? `${anchor.name} · ${anchor.context}`
                    : anchor.name
                  : t('curate.unanchored')}
              </Text>
            </View>
          </View>

          <Text className="px-1 text-subtitle font-bold text-text">{t('curate.hero')}</Text>

          {/* The field takes all the slack — this is a paragraph, not a field. */}
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={t('curate.placeholder')}
            placeholderTextColor={softColor}
            multiline
            textAlignVertical="top"
            autoFocus
            className="flex-1 px-1 py-0 text-[16px] leading-6 text-text"
          />

          <Text className="px-1 text-[11px] leading-4 text-text-soft">
            {t('curate.hint')} <Text className="font-semibold text-like">{t('curate.hintPublic')}</Text>
          </Text>

          <Pressable
            onPress={handleSubmit}
            disabled={!filled}
            accessibilityRole="button"
            accessibilityLabel={t('curate.cta')}
            accessibilityState={{ disabled: !filled }}
            // Disabled dim via inline style — NativeWind can leave a toggled
            // opacity-* class stuck (see button.tsx).
            style={{ opacity: filled ? 1 : 0.35 }}
            className={`items-center justify-center rounded-card bg-text px-4 py-3.5 ${PRESS}`}
          >
            <Text className="text-small font-semibold text-bg">{t('curate.cta')}</Text>
          </Pressable>
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
