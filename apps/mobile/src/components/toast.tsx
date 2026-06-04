import type { ReactNode } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { Icon, type IconName } from './icon';
import { SHADOW_TOAST } from '../theme/palette';
import { triggerHaptic } from '../lib/haptics';

/**
 * The toast pill (kebi-toasts-dark-mockup.html) — presentational only; the
 * queue, animation, and auto-dismiss live in `toast-context`. Always the
 * opposite of the page (dark pill in light mode, cream in dark) via the
 * `--toast-*` tokens. A leading badge is either a tone-coloured icon circle
 * (success/neutral/warm/danger) or a bare emoji; the trailing slot is a single
 * action (undo/retry) or, when there's none, a × close button. Place names in
 * `text` are emphasised by the caller (nested bold `Text`).
 */
export type ToastTone = 'success' | 'neutral' | 'warm' | 'danger';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastProps {
  text: ReactNode;
  /** Icon-circle tone; ignored when `emoji` is set. Defaults to `neutral`. */
  tone?: ToastTone;
  /** Glyph inside the tone circle. */
  icon?: IconName;
  /** Bare emoji badge (no circle) — alternative to `icon`. */
  emoji?: string;
  /** Single trailing action (undo/retry). */
  action?: ToastAction;
  /** Shown as a × when there's no action. */
  onClose?: () => void;
}

const TONE: Record<ToastTone, { bg: string; fg: string }> = {
  success: { bg: 'bg-toast-success-bg', fg: 'text-toast-success-fg' },
  neutral: { bg: 'bg-toast-neutral-bg', fg: 'text-toast-neutral-fg' },
  warm: { bg: 'bg-toast-warm-bg', fg: 'text-toast-warm-fg' },
  danger: { bg: 'bg-toast-danger-bg', fg: 'text-toast-danger-fg' },
};

export function Toast({ text, tone = 'neutral', icon, emoji, action, onClose }: ToastProps) {
  const t = TONE[tone];
  // Cap at the stack width (screen − 16px insets each side) so a long message
  // grows to one line then wraps, instead of collapsing to min-width.
  const { width } = useWindowDimensions();
  return (
    <View
      className="min-w-[200px] flex-row items-center gap-2.5 rounded-large bg-toast-bg px-3.5 py-2.5"
      style={[SHADOW_TOAST, { maxWidth: width - 32 }]}
    >
      {emoji ? (
        <Text className="text-[18px] leading-none">{emoji}</Text>
      ) : icon ? (
        <View className={`h-[22px] w-[22px] items-center justify-center rounded-full ${t.bg}`}>
          <Icon name={icon} size={12} className={t.fg} />
        </View>
      ) : null}

      <Text className="flex-auto text-[13px] font-medium leading-[1.4] text-toast-fg">{text}</Text>

      {action ? (
        <Pressable
          onPress={() => {
            triggerHaptic('toast-undo');
            action.onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={6}
          className="rounded-medium px-2.5 py-1"
        >
          <Text className="text-[13px] font-semibold text-toast-fg">{action.label}</Text>
        </Pressable>
      ) : onClose ? (
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="dismiss"
          hitSlop={8}
          className="h-[22px] w-[22px] items-center justify-center rounded-full"
        >
          <Icon name="close" size={11} className="text-toast-muted" />
        </Pressable>
      ) : null}
    </View>
  );
}
