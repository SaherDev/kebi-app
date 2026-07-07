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
import { DURATION, PRESS, SPRING_CONFIG } from '../theme/motion';
import { triggerHaptic } from '../lib/haptics';
import { useTranslation } from '../i18n/context';
import { useToast } from './toast-context';

/**
 * Note sheet — the bottom sheet for writing/editing a saved place's note. Shares
 * the save-sheet language (grabber, scrim, spring up, drag/backdrop to dismiss,
 * a textarea body floating above the keyboard) but pre-fills with the existing
 * note and saves through the global place actions. An absolute overlay (not a
 * Modal) so toasts layer above it.
 *
 * Presentational: the draft is local, seeded from `initialNote` on open. The CTA
 * is active only when the text actually changed (so an empty note can be cleared,
 * but an unchanged one can't no-op-save). Submitting hands the trimmed text to
 * `onSubmit`; persistence is the provider's job.
 */
interface NoteSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
  /** The current note to edit, or null when adding a fresh one. */
  initialNote: string | null;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SCRIM_COLOR = 'rgba(15, 13, 10, 0.45)';
const CLOSE_DISTANCE = 90;
const CLOSE_VELOCITY = 800;
const PAN_ACTIVATE_Y = 10;

export function NoteSheet({ open, onClose, onSubmit, initialNote }: NoteSheetProps) {
  const { t } = useTranslation();
  const { reserveTopAnchor } = useToast();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const softColor = useUnstableNativeVariable('--text-soft') ?? undefined;

  const [mounted, setMounted] = useState(open);
  const [value, setValue] = useState('');
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

  // Seed the draft with the existing note each time the sheet opens.
  useEffect(() => {
    if (open) setValue(initialNote ?? '');
  }, [open, initialNote]);

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

  const changed = value.trim() !== (initialNote ?? '').trim();
  const title = initialNote ? t('note.editTitle') : t('note.addTitle');

  const handleSave = () => {
    if (!changed) return;
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
          style={[styles.sheet, sheetStyle, { paddingBottom: insets.bottom + 12 }]}
          className="bg-bg"
        >
          <View className="mx-auto mb-0.5 h-1 w-9 rounded-full bg-surface-2" />

          <View className="gap-1 px-1">
            <Text className="text-eyebrow font-semibold uppercase text-text-soft">
              {t('note.eyebrow')}
            </Text>
            <Text className="text-subtitle font-bold text-text">{title}</Text>
          </View>

          <View className="rounded-large bg-surface px-3.5 pb-3 pt-3.5">
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={t('note.placeholder')}
              placeholderTextColor={softColor}
              multiline
              textAlignVertical="top"
              autoFocus
              className="min-h-14 p-0 text-[16px] leading-6 text-text"
            />
          </View>

          <Pressable
            onPress={handleSave}
            disabled={!changed}
            accessibilityRole="button"
            accessibilityLabel={t('note.cta')}
            accessibilityState={{ disabled: !changed }}
            // Disabled dim via inline style — see button.tsx (NativeWind can leave a
            // toggled opacity-* class stuck).
            style={{ opacity: changed ? 1 : 0.4 }}
            className={`items-center justify-center rounded-card bg-text px-4 py-3.5 ${PRESS}`}
          >
            <Text className="text-small font-semibold text-bg">{t('note.cta')}</Text>
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
