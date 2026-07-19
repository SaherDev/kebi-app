import { useEffect, useState } from 'react';
import {
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
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { FeedbackCategory } from '@kebi-app/shared';
import { FEEDBACK_CATEGORIES } from '@kebi-app/shared';
import { DURATION, PRESS, SPRING_CONFIG } from '../theme/motion';
import { triggerHaptic } from '../lib/haptics';
import { useTranslation } from '../i18n/context';
import { useToast } from './toast-context';
import { Icon } from './icon';

/**
 * "kebi got it wrong" report sheet (kebi-help-mockup.html). Quotes the latest
 * exchange so the user sees exactly what they're reporting, one tap category,
 * one "what did you expect?" field, and the attach disclosure. Send needs a
 * chip OR text. With no exchange (help opened before any chat this session)
 * the quote hides and the disclosure switches to the nothing-attached variant.
 *
 * Presentational: `onSubmit` resolving means sent (the caller closes and
 * toasts); rejecting keeps the sheet open with the draft intact.
 */
interface ReportWrongAnswerSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { category?: FeedbackCategory; text?: string }) => Promise<void>;
  /** The latest you→kebi pair, or undefined when the session has no chat. */
  exchange?: { you: string; kebi: string };
}

const CATEGORY_LABEL_KEYS: Record<FeedbackCategory, string> = {
  wrong_place: 'help.chipWrongPlace',
  didnt_get_me: 'help.chipDidntGetMe',
  missing_info: 'help.chipMissingInfo',
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SCRIM_COLOR = 'rgba(15, 13, 10, 0.45)';
const CLOSE_DISTANCE = 90;
const CLOSE_VELOCITY = 800;
const PAN_ACTIVATE_Y = 10;

export function ReportWrongAnswerSheet({
  open,
  onClose,
  onSubmit,
  exchange,
}: ReportWrongAnswerSheetProps) {
  const { t } = useTranslation();
  const { reserveTopAnchor } = useToast();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const softColor = useUnstableNativeVariable('--text-soft') ?? undefined;

  const [mounted, setMounted] = useState(open);
  const [value, setValue] = useState('');
  const [category, setCategory] = useState<FeedbackCategory | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const scrim = useSharedValue(0);
  const translateY = useSharedValue(height);
  const keyboard = useAnimatedKeyboard();

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    return reserveTopAnchor();
  }, [mounted, reserveTopAnchor]);

  // Fresh draft each time the sheet opens.
  useEffect(() => {
    if (open) {
      setValue('');
      setCategory(undefined);
      setSubmitting(false);
    }
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
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value - keyboard.height.value }],
  }));

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

  if (!mounted) return null;

  const canSend = (category !== undefined || value.trim().length > 0) && !submitting;

  const handleSend = async () => {
    if (!canSend) return;
    setSubmitting(true);
    try {
      await onSubmit({ category, text: value.trim() || undefined });
      triggerHaptic('save-sheet-confirm');
    } catch {
      // The caller toasts; the draft survives for a retry.
      setSubmitting(false);
    }
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
          style={[styles.sheet, sheetStyle, { paddingBottom: insets.bottom + 12 }]}
          className="bg-bg"
        >
          <View className="mx-auto mb-0.5 h-1 w-9 rounded-full bg-surface-2" />

          <View className="gap-1 px-1">
            <Text className="text-eyebrow font-semibold uppercase text-text-soft">
              {t('help.sheetWrongEyebrow')}
            </Text>
            <Text className="text-subtitle font-bold text-text">{t('help.sheetWrongTitle')}</Text>
          </View>

          {exchange ? (
            <View className="gap-2 rounded-large bg-surface px-3.5 py-3">
              <View className="flex-row gap-2">
                <Text className="w-8 text-eyebrow font-bold uppercase text-text-soft">
                  {t('help.quoteYou')}
                </Text>
                <Text className="flex-1 text-small leading-5 text-text-muted" numberOfLines={2}>
                  {exchange.you}
                </Text>
              </View>
              <View className="flex-row gap-2">
                <Text className="w-8 text-eyebrow font-bold uppercase text-text-soft">
                  {t('help.quoteKebi')}
                </Text>
                <Text className="flex-1 text-small leading-5 text-text-muted" numberOfLines={2}>
                  {exchange.kebi}
                </Text>
              </View>
            </View>
          ) : null}

          <View className="flex-row flex-wrap gap-2">
            {FEEDBACK_CATEGORIES.map((option) => {
              const selected = category === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => {
                    triggerHaptic('filter-chip');
                    setCategory(selected ? undefined : option);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t(CATEGORY_LABEL_KEYS[option])}
                  accessibilityState={{ selected }}
                  className={`rounded-full px-3.5 py-2 ${PRESS} ${
                    selected ? 'bg-text' : 'bg-surface'
                  }`}
                >
                  <Text
                    className={`text-small ${
                      selected ? 'font-semibold text-bg' : 'font-medium text-text'
                    }`}
                  >
                    {t(CATEGORY_LABEL_KEYS[option])}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="rounded-large bg-surface px-3.5 pb-3 pt-3.5">
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={t('help.sheetWrongPlaceholder')}
              placeholderTextColor={softColor}
              multiline
              textAlignVertical="top"
              autoFocus
              editable={!submitting}
              className="min-h-14 p-0 text-[16px] leading-6 text-text"
            />
          </View>

          <View className="flex-row items-start gap-2 px-1">
            <Icon name="link" size={13} className="mt-0.5 text-text-muted" />
            <Text className="flex-1 text-small leading-5 text-text-muted">
              {exchange ? t('help.sheetWrongNote') : t('help.sheetWrongNoteEmpty')}
            </Text>
          </View>

          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={t('help.send')}
            accessibilityState={{ disabled: !canSend }}
            // Disabled dim via inline style — see button.tsx (NativeWind can leave a
            // toggled opacity-* class stuck).
            style={{ opacity: canSend ? 1 : 0.4 }}
            className={`flex-row items-center justify-center gap-2 rounded-card bg-text px-4 py-3.5 ${PRESS}`}
          >
            <Icon name="send" size={14} className="text-bg" />
            <Text className="text-small font-semibold text-bg">{t('help.send')}</Text>
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
    gap: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 24,
  },
});
