import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useColorScheme } from 'nativewind';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { DURATION, SPRING_CONFIG } from '../../theme/motion';
import { BLUR_INTENSITY, SCRIM, SHADOW_LIFT } from '../../theme/palette';
import { ContextMenuList, MENU_WIDTH } from './context-menu-list';
import {
  computeMenuPlacement,
  estimateMenuHeight,
  type Size,
} from './context-menu-placement';
import type { ContextMenuItem, MenuRect } from './context-menu-types';

/**
 * Long-press context menu (iOS lift + blur — kebi-context-menu-mockup.html). A
 * root provider holds the single open menu and renders one overlay host as a
 * sibling of the app (mirrors ToastProvider), so only one menu is open at a time
 * and its frosted BlurView blurs the real screen behind it. `ContextMenuTrigger`
 * opens it on long-press; the ••• overflow menu is a separate, blur-free path.
 */

interface OpenConfig {
  rect: MenuRect;
  items: ContextMenuItem[];
  /** Re-renders the pressed card as the lifted clone in the overlay. */
  renderCard: () => ReactNode;
  /** a11y — announced when the menu opens (usually the card's title). */
  label?: string;
}

interface ContextMenuValue {
  open: (config: OpenConfig) => void;
  close: () => void;
}

// No-op fallback so useContextMenu() outside a provider is harmless (matches
// the i18n/toast context pattern).
const fallback: ContextMenuValue = { open: () => undefined, close: () => undefined };
const ContextMenuCtx = createContext<ContextMenuValue>(fallback);

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<OpenConfig | null>(null);
  const open = useCallback((config: OpenConfig) => setActive(config), []);
  const close = useCallback(() => setActive(null), []);
  const value = useMemo<ContextMenuValue>(() => ({ open, close }), [open, close]);

  return (
    <ContextMenuCtx.Provider value={value}>
      {children}
      {active ? <ContextMenuOverlay config={active} onClose={close} /> : null}
    </ContextMenuCtx.Provider>
  );
}

/** Open/close the long-press context menu from anywhere under the provider. */
export function useContextMenu(): ContextMenuValue {
  return useContext(ContextMenuCtx);
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Lift scale of the picked-up card (kebi-context-menu-mockup.html). */
const LIFT_SCALE = 1.03;

function ContextMenuOverlay({ config, onClose }: { config: OpenConfig; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const screen: Size = { width, height };
  const menuSize: Size = { width: MENU_WIDTH, height: estimateMenuHeight(config.items) };
  const placement = computeMenuPlacement(config.rect, menuSize, screen, insets);

  const progress = useSharedValue(0); // backdrop + menu opacity
  const cloneScale = useSharedValue(1);
  const cloneShift = useSharedValue(0); // card travels up to make room
  const menuScale = useSharedValue(0.96);
  const menuShift = useSharedValue(-6); // small slide-down from under the card

  useEffect(() => {
    progress.value = withTiming(1, { duration: DURATION.stateChangeFast });
    cloneScale.value = withSpring(LIFT_SCALE, SPRING_CONFIG.entrance);
    cloneShift.value = withSpring(placement.cardShift, SPRING_CONFIG.entrance);
    menuScale.value = withSpring(1, SPRING_CONFIG.entrance);
    menuShift.value = withSpring(0, SPRING_CONFIG.entrance);
  }, [progress, cloneScale, cloneShift, menuScale, menuShift, placement.cardShift]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const cloneStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cloneShift.value }, { scale: cloneScale.value }],
  }));
  const menuStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: menuShift.value }, { scale: menuScale.value }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Frosted, dimmed backdrop — tap anywhere to dismiss. */}
      <AnimatedPressable
        style={[StyleSheet.absoluteFill, backdropStyle]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={config.label}
      >
        <BlurView
          intensity={isDark ? BLUR_INTENSITY.dark : BLUR_INTENSITY.light}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'black', opacity: isDark ? SCRIM.dark : SCRIM.light },
          ]}
        />
      </AnimatedPressable>

      {/* The lifted clone, pinned over the original card (which it fully covers). */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: config.rect.x,
            top: config.rect.y,
            width: config.rect.width,
          },
          SHADOW_LIFT,
          cloneStyle,
        ]}
      >
        {config.renderCard()}
      </Animated.View>

      {/* The menu always sits directly below the (possibly shifted-up) card,
          capped to the bottom safe area — it scrolls if its content is taller. */}
      <Animated.View
        style={[
          { position: 'absolute', left: placement.left, top: placement.menuTop, width: MENU_WIDTH },
          menuStyle,
        ]}
      >
        <ContextMenuList
          items={config.items}
          onSelect={onClose}
          maxHeight={placement.menuMaxHeight}
        />
      </Animated.View>
    </View>
  );
}
