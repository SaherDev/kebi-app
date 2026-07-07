import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { DURATION, SPRING_CONFIG } from '../theme/motion';
import type { ContextMenuItem } from './context-menu/context-menu-types';

/**
 * Bottom action sheet — the place page's equivalent of the cards' long-press
 * menu (kebi-context-menu-mockup.html action-sheet section). Tapping the ••• on
 * the place page springs this up from the bottom in the save-sheet language:
 * grabber, place header, positive actions on one `--surface` group, and the
 * destructive action set apart in its own group below. Tap the backdrop to
 * dismiss. Items reuse `ContextMenuItem`; they're split into a non-destructive
 * group and a destructive group by `destructive`.
 */

export interface ActionSheetHeader {
  /** Emoji shown in the header avatar tile. */
  emoji?: string;
  /** Small uppercase line above the title (e.g. "this place"). */
  eyebrow?: string;
  title: string;
}

interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  header: ActionSheetHeader;
  items: ContextMenuItem[];
  /** a11y label for the dismiss backdrop (e.g. t('common.close')). */
  closeLabel?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Warm near-black scrim, matching the save sheet (rgba(15,13,10,0.45)).
const SCRIM_COLOR = 'rgba(15, 13, 10, 0.45)';

// Drag the sheet down past this distance, or flick it faster than this, to close.
const CLOSE_DISTANCE = 90;
const CLOSE_VELOCITY = 800;
// The pan only takes over after this much downward travel, so row taps still work.
const PAN_ACTIVATE_Y = 10;

export function ActionSheet({ open, onClose, header, items, closeLabel }: ActionSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [mounted, setMounted] = useState(open);
  const scrim = useSharedValue(0);
  const translateY = useSharedValue(height);

  useEffect(() => {
    if (open) setMounted(true);
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
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  // Drag the sheet down to dismiss; a small drag springs back. Only follows the
  // finger downward (clamped at 0), and activates after PAN_ACTIVATE_Y so taps on
  // the rows still register.
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

  const positives = items.filter((i) => !i.destructive);
  const destructives = items.filter((i) => i.destructive);

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <AnimatedPressable
          style={[StyleSheet.absoluteFill, scrimStyle, { backgroundColor: SCRIM_COLOR }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
        />

        <GestureDetector gesture={pan}>
          <Animated.View
            style={[styles.sheet, sheetStyle, { paddingBottom: insets.bottom + 12 }]}
            className="bg-bg"
          >
          <View className="mx-auto mb-0.5 h-1 w-9 rounded-full bg-surface-2" />

          <View className="flex-row items-center gap-3 px-1 pb-1 pt-0.5">
            {header.emoji ? (
              <View className="size-9 items-center justify-center rounded-[10px] bg-surface-2">
                <Text className="text-[19px]">{header.emoji}</Text>
              </View>
            ) : null}
            <View>
              {header.eyebrow ? (
                <Text className="text-eyebrow font-semibold uppercase text-text-soft">
                  {header.eyebrow}
                </Text>
              ) : null}
              <Text className="text-subtitle font-bold text-text">{header.title}</Text>
            </View>
          </View>

            <SheetGroup items={positives} onClose={onClose} />
            {destructives.length > 0 ? <SheetGroup items={destructives} onClose={onClose} /> : null}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

function SheetGroup({ items, onClose }: { items: ContextMenuItem[]; onClose: () => void }) {
  return (
    <View className="overflow-hidden rounded-large bg-surface">
      {items.map((item, index) => (
        <Pressable
          key={`${item.emoji}-${item.label}`}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          onPress={() => {
            item.onPress();
            onClose();
          }}
          className={`flex-row items-center gap-3 px-3.5 py-3.5 active:bg-surface-2 ${
            index > 0 ? 'border-t border-bg' : ''
          }`}
        >
          <View className="w-6 items-center">
            <Text className="text-[17px]">{item.emoji}</Text>
          </View>
          <Text className={`text-body font-medium ${item.destructive ? 'text-danger' : 'text-text'}`}>
            {item.label}
          </Text>
        </Pressable>
      ))}
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
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 24,
  },
});
