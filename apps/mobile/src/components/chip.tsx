import type { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { Icon, type IconName } from './icon';

/**
 * A small labelled pill for place attributes (kebi-tokens-mockup.html `.chip`).
 * Two variants — keep them in separate rows, never mixed:
 *   atmosphere = vibe, emoji-prefixed, `--surface-2` fill (e.g. 🕯️ intimate)
 *   feature    = practical attribute, outlined, optional small icon (e.g. dog friendly)
 *
 * Light/dark is automatic via the CSS-variable tokens.
 */
type ChipVariant = 'atmosphere' | 'feature';

interface ChipProps {
  variant?: ChipVariant;
  /** Emoji prefix for atmosphere chips (e.g. `🕯️`). */
  emoji?: string;
  /** Small leading icon for feature chips. */
  icon?: IconName;
  /** The label — pass an already-translated string. */
  children: ReactNode;
}

export function Chip({ variant = 'atmosphere', emoji, icon, children }: ChipProps) {
  if (variant === 'feature') {
    return (
      <View className="flex-row items-center self-start rounded-full border border-surface-2 bg-transparent px-2.5 py-[5px]">
        {icon ? <Icon name={icon} size={14} className="me-[5px] text-text-muted" /> : null}
        <Text className="text-[12px] font-medium text-text-muted">{children}</Text>
      </View>
    );
  }
  return (
    <View className="flex-row items-center self-start rounded-full bg-surface-2 px-3 py-1.5">
      {emoji ? <Text className="me-[5px] text-small">{emoji}</Text> : null}
      <Text className="text-small font-medium text-text">{children}</Text>
    </View>
  );
}
