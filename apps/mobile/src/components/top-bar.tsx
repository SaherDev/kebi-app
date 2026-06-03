import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TopBarProps {
  /** Left slot — a back/close IconButton, or a custom row (home location). */
  left?: ReactNode;
  /** Center slot — screen-centered content (chat title-pill). Balanced by equal-width left/right slots. */
  center?: ReactNode;
  /** Right slot — usually a TopPill (or a chat title-pill). */
  right?: ReactNode;
}

/**
 * Top-bar pattern shared by every screen: left slot + right slot, padded below
 * the status-bar safe area. Horizontal padding 16, top 12 (over the 50px inset),
 * bottom 12 — per design-system.md (`padding: 12px 16px`). An optional center
 * slot sits screen-centered between equal-width left/right slots (kebi-chat-mockup).
 */
export function TopBar({ left, center, right }: TopBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-row items-center justify-between px-4 pb-3"
      style={{ paddingTop: insets.top + 12 }}
    >
      <View className="flex-row items-center">{left}</View>
      {center ? <View className="flex-1 items-center">{center}</View> : null}
      <View className="flex-row items-center">{right}</View>
    </View>
  );
}
