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
import type { FeedbackSaveAttempt } from '@kebi-app/shared';
import { DURATION, PRESS, SPRING_CONFIG } from '../theme/motion';
import { triggerHaptic } from '../lib/haptics';
import { useTranslation } from '../i18n/context';
import { useToast } from './toast-context';
import { Icon } from './icon';

/**
 * "a save went wrong" report sheet (kebi-help-mockup.html, ADR-051). Quotes the
 * latest recorded save attempt — what the user sent and what kebi made of it —
 * the same way the wrong-answer sheet quotes the chat exchange; recent attempts
 * ride the payload automatically (lib/save-history). With nothing recorded
 * (help opened before any save this session) the quote is replaced by a manual
 * link field and the disclosure switches to the nothing-attached variant.
 *
 * Presentational: `onSubmit` resolving means sent (the caller closes and
 * toasts); rejecting keeps the sheet open with the draft intact.
 */
interface ReportSaveSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { text: string; input?: string }) => Promise<void>;
  /** The latest recorded save attempt, or undefined when none this session. */
  latest?: FeedbackSaveAttempt;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SCRIM_COLOR = 'rgba(15, 13, 10, 0.45)';
const CLOSE_DISTANCE = 90;
const CLOSE_VELOCITY = 800;
const PAN_ACTIVATE_Y = 10;

export function ReportSaveSheet({ open, onClose, onSubmit, latest }: ReportSaveSheetProps) {
  const { t } = useTranslation();
  const { reserveTopAnchor } = useToast();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const softColor = useUnstableNativeVariable('--text-soft') ?? undefined;

  const [mounted, setMounted] = useState(open);
  const [value, setValue] = useState('');
  const [input, setInput] = useState('');
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
      setInput('');
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

  const canSend = value.trim().length > 0 && !submitting;

  const handleSend = async () => {
    if (!canSend) return;
    setSubmitting(true);
    try {
      await onSubmit({ text: value.trim(), input: input.trim() || undefined });
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
              {t('help.sheetSaveEyebrow')}
            </Text>
            <Text className="text-subtitle font-bold text-text">{t('help.sheetSaveTitle')}</Text>
          </View>

          {latest ? (
            <View className="gap-2 rounded-large bg-surface px-3.5 py-3">
              <View className="flex-row gap-2">
                <Text className="w-10 text-eyebrow font-bold uppercase text-text-soft">
                  {t('help.quoteSent')}
                </Text>
                <Text className="flex-1 text-small leading-5 text-text-muted" numberOfLines={2}>
                  {latest.input}
                </Text>
              </View>
              <View className="flex-row gap-2">
                <Text className="w-10 text-eyebrow font-bold uppercase text-text-soft">
                  {t('help.quoteGot')}
                </Text>
                <Text className="flex-1 text-small leading-5 text-text-muted" numberOfLines={2}>
                  {latest.result}
                </Text>
              </View>
            </View>
          ) : (
            <View className="rounded-large bg-surface px-3.5 py-3">
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={t('help.sheetSaveInputPlaceholder')}
                placeholderTextColor={softColor}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
                className="p-0 text-[16px] leading-6 text-text"
              />
            </View>
          )}

          <View className="rounded-large bg-surface px-3.5 pb-3 pt-3.5">
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={t('help.sheetSavePlaceholder')}
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
              {latest ? t('help.sheetSaveNote') : t('help.sheetSaveNoteEmpty')}
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
