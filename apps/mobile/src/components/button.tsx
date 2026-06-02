import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

/**
 * The shared button (kebi-tokens-mockup.html `.btn` + `.btn.primary/.outlined/
 * .danger`). Three variants only — one primary per screen:
 *   primary  = filled with `--text` (the screen's single most important action)
 *   outlined = transparent with a `--surface-2` hairline border
 *   danger   = filled red for destructive actions.
 *
 * Presentational only: pass an already-translated `label`; i18n stays at the
 * call site. Light/dark swaps automatically via the CSS-variable tokens.
 */
type ButtonVariant = 'primary' | 'outlined' | 'danger';

interface ButtonProps {
  /** Button text — pass an already-translated string. */
  label: string;
  variant?: ButtonVariant;
  onPress?: () => void;
  disabled?: boolean;
}

// Per-variant token classes: [container surface/border, label tone].
const VARIANT: Record<ButtonVariant, { box: string; text: string }> = {
  primary: { box: 'bg-text', text: 'text-bg' },
  outlined: { box: 'bg-transparent border-[1.5px] border-surface-2', text: 'text-text' },
  danger: { box: 'bg-danger', text: 'text-white' },
};

export function Button({ label, variant = 'primary', onPress, disabled = false }: ButtonProps) {
  const v = VARIANT[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={`items-center justify-center rounded-card px-4 py-2.5 ${v.box} ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      <Text className={`text-small font-semibold ${v.text}`}>{label}</Text>
    </Pressable>
  );
}
