import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnstableNativeVariable } from 'nativewind';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { DURATION, PRESS, SPRING_CONFIG } from '../theme/motion';
import { detectSource, isLinkSource } from '../lib/detect-source';
import { triggerHaptic } from '../lib/haptics';
import { useTranslation } from '../i18n/context';
import { Icon } from './icon';
import { Spinner } from './spinner';

/**
 * Save sheet (kebi-save-sheet-{empty,,saving}-mockup.html). The bottom sheet for
 * capturing a new place: paste a link or type a place name, kebi figures out the
 * rest. Shares the action-sheet language — grabber, scrim, spring up from the
 * bottom, drag/backdrop to dismiss — with a textarea body. Three states:
 *   empty  → CTA disabled (35% opacity), no meta row
 *   filled → source meta row appears for link inputs, CTA active
 *   saving → spinner + "saving", input + dismissal locked
 *
 * Presentational: `status` is owned by the caller so the API task only flips it;
 * the draft text is local and resets on each open. Submitting fires the save
 * haptic and hands the text to `onSubmit` — persistence is wired separately.
 */
type SaveSheetStatus = 'idle' | 'saving';

interface SaveSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
  status?: SaveSheetStatus;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Warm near-black scrim, matching the action sheet (rgba(15,13,10,0.45)).
const SCRIM_COLOR = 'rgba(15, 13, 10, 0.45)';

// Drag the sheet down past this distance, or flick it faster than this, to close.
const CLOSE_DISTANCE = 90;
const CLOSE_VELOCITY = 800;
// The pan only takes over after this much downward travel, so the textarea is usable.
const PAN_ACTIVATE_Y = 10;

export function SaveSheet({ open, onClose, onSubmit, status = 'idle' }: SaveSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const softColor = useUnstableNativeVariable('--text-soft') ?? undefined;

  const [mounted, setMounted] = useState(open);
  const [value, setValue] = useState('');
  const scrim = useSharedValue(0);
  const translateY = useSharedValue(height);
  const keyboard = useAnimatedKeyboard();

  const saving = status === 'saving';

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  // Each open starts a fresh draft (kebi-save-sheet-empty state).
  useEffect(() => {
    if (open) setValue('');
  }, [open]);

  // Entrance: scrim fades in, sheet springs up from the bottom.
  useEffect(() => {
    if (mounted && open) {
      scrim.value = withTiming(1, { duration: DURATION.stateChangeFast });
      translateY.value = withSpring(0, SPRING_CONFIG.sheet);
    }
  }, [mounted, open, scrim, translateY]);

  // Exit: sheet slides down, scrim fades out, then unmount.
  useEffect(() => {
    if (!open && mounted) {
      scrim.value = withTiming(0, { duration: DURATION.stateChangeFast });
      translateY.value = withTiming(height, { duration: DURATION.stateChange }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [open, mounted, scrim, translateY, height]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));
  // Float the sheet above the keyboard: subtract its height from the rest offset.
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value - keyboard.height.value }],
  }));

  // Drag the sheet down to dismiss; a small drag springs back. Disabled while
  // saving so a place in flight can't be dismissed (design-system §Save sheet).
  const pan = Gesture.Pan()
    .enabled(!saving)
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

  const source = detectSource(value);
  const showMeta = value.trim() !== '' && isLinkSource(source);
  const isEmpty = value.trim() === '';
  const canSave = !isEmpty && !saving;

  const handleSave = () => {
    if (!canSave) return;
    triggerHaptic('save-sheet-confirm');
    onSubmit(value);
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={saving ? undefined : onClose}>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <AnimatedPressable
          style={[StyleSheet.absoluteFill, scrimStyle, { backgroundColor: SCRIM_COLOR }]}
          onPress={saving ? undefined : onClose}
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
                {t('save.eyebrow')}
              </Text>
              <Text className="text-subtitle font-bold text-text">{t('save.title')}</Text>
            </View>

            <View className="rounded-large bg-surface px-3.5 pb-3 pt-3.5">
              <TextInput
                value={value}
                onChangeText={setValue}
                editable={!saving}
                placeholder={t('save.placeholder')}
                placeholderTextColor={softColor}
                multiline
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
                className="min-h-14 p-0 text-[16px] leading-6 text-text"
              />
              {showMeta ? (
                <View className="mt-2 flex-row items-center gap-2 border-t border-surface-2 pt-2">
                  <Icon name="link" size={12} className="text-text-muted" />
                  <Text className="text-small text-text-muted">{t(`save.source.${source}`)}</Text>
                </View>
              ) : null}
            </View>

            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityLabel={saving ? t('save.saving') : t('save.cta')}
              accessibilityState={{ disabled: !canSave, busy: saving }}
              // Disabled/saving dim via inline style — see button.tsx: a toggled
              // `opacity-*` className can stay stuck dim under NativeWind.
              style={{ opacity: canSave ? 1 : 0.4 }}
              className={`flex-row items-center justify-center gap-2 rounded-card bg-text px-4 py-3.5 ${PRESS}`}
            >
              {saving ? <Spinner /> : null}
              <Text className="text-small font-semibold text-bg">
                {saving ? t('save.saving') : t('save.cta')}
              </Text>
            </Pressable>

            <View className="flex-row items-center justify-center gap-1.5">
              <Icon name="alert" size={11} className="text-text-soft" />
              <Text className="text-small text-text-soft">{t('save.hint')}</Text>
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
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
