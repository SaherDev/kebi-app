import type { ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Icon, type IconName } from './icon';
import { PRESS } from '../theme/motion';

/**
 * A settings-style row: icon-square (or emoji) + label + optional sublabel +
 * trailing. Extracted from the settings screen when the help page became its
 * second consumer (kebi-settings-mockup.html / kebi-help-mockup.html share the
 * row anatomy).
 */
export function SettingsRow({
  icon,
  emoji,
  label,
  sublabel,
  danger = false,
  trailing,
  onPress,
}: {
  icon?: IconName;
  emoji?: string;
  label: string;
  sublabel?: string;
  danger?: boolean;
  trailing?: ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <>
      <View
        className={`h-8 w-8 items-center justify-center rounded-small ${
          danger ? 'bg-pill-danger-bg' : 'bg-bg'
        }`}
      >
        {emoji ? (
          // Emoji glyphs render taller than their font box; a tight lineHeight
          // (leading-none) clips them on iOS, so give it room and let the
          // centering container place it.
          <Text style={{ fontSize: 16, lineHeight: 20 }}>{emoji}</Text>
        ) : icon ? (
          <Icon name={icon} size={15} className={danger ? 'text-danger' : 'text-text'} />
        ) : null}
      </View>
      <View className="flex-1 gap-0.5">
        <Text className={`text-body font-medium ${danger ? 'text-danger' : 'text-text'}`}>
          {label}
        </Text>
        {sublabel ? <Text className="text-small text-text-muted">{sublabel}</Text> : null}
      </View>
      {trailing}
    </>
  );

  if (!onPress) {
    return <View className="flex-row items-center gap-3 py-2">{body}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`flex-row items-center gap-3 py-2 ${PRESS}`}
    >
      {body}
    </Pressable>
  );
}
