import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Toast, type ToastAction, type ToastTone } from './toast';
import type { IconName } from './icon';
import { DURATION, SPRING_CONFIG, TOAST_DISMISS_MS } from '../theme/motion';

/**
 * Toast system (kebi-tokens-mockup.html §12). A `ToastProvider` holds a queue of
 * up to three toasts and renders an animated host that floats above the AI FAB;
 * `useToast().show(...)` enqueues from anywhere. Each toast springs in
 * (SPRING_CONFIG.entrance) and auto-dismisses (3s, or 5s when it has an action).
 * Mirrors the i18n context pattern (provider + hook + no-op fallback).
 */
const MAX_TOASTS = 3;
/** Clearance above the bottom edge: 64px FAB + breathing room (mockup ~92px). */
const FAB_CLEARANCE = 88;
/** Clearance below the top safe-area when a toast anchors to the top (sheet open). */
const TOP_CLEARANCE = 12;
const STACK_GAP = 8;

/** Where a toast sits — top while a bottom sheet covers the usual bottom spot. */
type ToastPlacement = 'top' | 'bottom';

interface ToastOptions {
  text: ReactNode;
  /** Icon-circle tone; ignored when `emoji` is set. */
  tone?: ToastTone;
  /** Glyph inside the tone circle. */
  icon?: IconName;
  /** Bare emoji badge — alternative to `icon`. */
  emoji?: string;
  /** Single trailing action (undo/retry); without it the toast shows a × close. */
  action?: ToastAction;
}

interface ToastItem extends ToastOptions {
  id: number;
  placement: ToastPlacement;
}

interface ToastContextValue {
  show: (opts: ToastOptions) => number;
  dismiss: (id: number) => void;
  /**
   * Reserve the top anchor: while held, new toasts render at the top of the
   * screen instead of the bottom. A bottom sheet calls this on mount so its
   * toasts clear the sheet. Returns a release fn (call on unmount). Ref-counted,
   * so nested/overlapping sheets compose.
   */
  reserveTopAnchor: () => () => void;
}

// No-op fallback so useToast() outside a provider is harmless (matches i18n).
const fallback: ToastContextValue = {
  show: () => -1,
  dismiss: () => undefined,
  reserveTopAnchor: () => () => undefined,
};
const ToastContext = createContext<ToastContextValue>(fallback);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  // Ref-counted top-anchor reservations — read synchronously in show() to stamp
  // each toast's placement at creation, so it never moves for its lifetime.
  const topReservations = useRef(0);

  const reserveTopAnchor = useCallback(() => {
    topReservations.current += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      topReservations.current -= 1;
    };
  }, []);

  const clearTimer = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      clearTimer(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [clearTimer],
  );

  const show = useCallback(
    (opts: ToastOptions) => {
      const id = (idRef.current += 1);
      const placement: ToastPlacement = topReservations.current > 0 ? 'top' : 'bottom';
      const item: ToastItem = { ...opts, id, placement };
      setToasts((prev) => {
        const next = [...prev, item];
        while (next.length > MAX_TOASTS) {
          const dropped = next.shift();
          if (dropped) clearTimer(dropped.id);
        }
        return next;
      });
      const ms = opts.action ? TOAST_DISMISS_MS.withAction : TOAST_DISMISS_MS.simple;
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), ms),
      );
      return id;
    },
    [clearTimer, dismiss],
  );

  // Clear any pending timers on unmount.
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ show, dismiss, reserveTopAnchor }),
    [show, dismiss, reserveTopAnchor],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/** Enqueue/dismiss toasts from anywhere under a ToastProvider. */
export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

function ToastHost({ toasts, dismiss }: { toasts: ToastItem[]; dismiss: (id: number) => void }) {
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) return null;
  // Two stacks so top- and bottom-anchored toasts can coexist (e.g. a sheet's
  // toast at the top while a normal one sits at the bottom).
  const top = toasts.filter((t) => t.placement === 'top');
  const bottom = toasts.filter((t) => t.placement !== 'top');
  return (
    <>
      {top.length > 0 && (
        <View
          pointerEvents="box-none"
          className="absolute left-4 right-4 items-center"
          style={{ top: insets.top + TOP_CLEARANCE, gap: STACK_GAP }}
        >
          {top.map((t) => (
            <AnimatedToast key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </View>
      )}
      {bottom.length > 0 && (
        <View
          pointerEvents="box-none"
          className="absolute left-4 right-4 items-center"
          style={{ bottom: insets.bottom + FAB_CLEARANCE, gap: STACK_GAP }}
        >
          {bottom.map((t) => (
            <AnimatedToast key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </View>
      )}
    </>
  );
}

function AnimatedToast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);
  const scale = useSharedValue(0.96);

  useEffect(() => {
    // Spring entrance — translateY(12)+scale(0.96) → rest (kebi-toasts mockup).
    opacity.value = withTiming(1, { duration: DURATION.stateChangeFast });
    translateY.value = withSpring(0, SPRING_CONFIG.entrance);
    scale.value = withSpring(1, SPRING_CONFIG.entrance);
  }, [opacity, translateY, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  // Pressing the action runs the caller's handler, then dismisses the toast.
  const action: ToastAction | undefined = item.action
    ? {
        label: item.action.label,
        onPress: () => {
          item.action?.onPress();
          onDismiss();
        },
      }
    : undefined;

  return (
    <Animated.View style={style}>
      <Toast
        text={item.text}
        tone={item.tone}
        icon={item.icon}
        emoji={item.emoji}
        action={action}
        onClose={item.action ? undefined : onDismiss}
      />
    </Animated.View>
  );
}
