import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../icon';
import { PRESS } from '../../theme/motion';

/**
 * One row in the login social-auth group (kebi-login-mockup.html `.auth-btn`):
 * a brand glyph, a label, and a trailing chevron. Sits on `--bg` inside the
 * `--surface` group container, with the shared press feedback.
 *
 * Presentational only — pass an already-translated `label` and the brand glyph
 * node; the screen owns i18n and the press handler.
 */
interface SocialButtonProps {
  /** Brand mark, e.g. <GoogleGlyph /> / <AppleGlyph />. */
  glyph: ReactNode;
  /** Button text — pass an already-translated string. */
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Trailing badge (already translated, e.g. "soon"); replaces the chevron. */
  badge?: string;
}

export function SocialButton({ glyph, label, onPress, disabled = false, badge }: SocialButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      accessibilityState={{ disabled }}
      // Disabled dim via inline style — see button.tsx: a toggled `opacity-*`
      // className can stay stuck dim under NativeWind. Inline opacity always wins.
      style={{ opacity: disabled ? 0.4 : 1 }}
      className={`flex-row items-center gap-3 rounded-medium bg-bg px-4 py-3.5 ${PRESS}`}
    >
      <View className="size-[18px] items-center justify-center">{glyph}</View>
      <Text className="flex-1 text-body font-semibold text-text">{label}</Text>
      {badge ? (
        <View className="rounded-full bg-surface-2 px-2 py-0.5">
          <Text className="text-eyebrow font-semibold uppercase text-text-soft">{badge}</Text>
        </View>
      ) : (
        <Icon name="chevron-right" size={14} className="text-text-soft" />
      )}
    </Pressable>
  );
}
