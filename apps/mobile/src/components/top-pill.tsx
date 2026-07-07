import type { ReactNode } from 'react';
import { View } from 'react-native';

interface TopPillProps {
  children: ReactNode;
}

/**
 * The right-hand pill in the top bar: a `surface` capsule holding 1–3 in-pill
 * IconButtons with no separators (kebi-tokens-mockup top-pill, `padding: 0 4px`).
 */
export function TopPill({ children }: TopPillProps) {
  return (
    <View className="flex-row items-center rounded-full bg-surface px-1">
      {children}
    </View>
  );
}
