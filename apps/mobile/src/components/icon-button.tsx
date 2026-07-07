import { Pressable } from 'react-native';
import { Icon, type IconName } from './icon';

interface IconButtonProps {
  icon: IconName;
  /** Accessibility label — every icon-only button needs one (iOS 44px target). */
  label: string;
  onPress?: () => void;
  /**
   * standalone = 40px circle on `surface` (left back/close button);
   * pill = 36px transparent circle (sits inside a TopPill).
   */
  variant?: 'standalone' | 'pill';
  /** Tailwind text-* class for the icon tone. */
  tone?: string;
}

export function IconButton({
  icon,
  label,
  onPress,
  variant = 'standalone',
  tone = 'text-text',
}: IconButtonProps) {
  const standalone = variant === 'standalone';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={standalone ? 4 : 8}
      className={`items-center justify-center rounded-full ${
        standalone ? 'h-10 w-10 bg-surface' : 'h-9 w-9 bg-transparent'
      }`}
    >
      <Icon name={icon} size={standalone ? 18 : 16} className={tone} />
    </Pressable>
  );
}
