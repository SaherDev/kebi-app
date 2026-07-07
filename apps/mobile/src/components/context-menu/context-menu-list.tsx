import { Pressable, ScrollView, Text, View } from 'react-native';
import { SHADOW_MENU } from '../../theme/palette';
import type { ContextMenuItem } from './context-menu-types';

/**
 * The menu card shared by the long-press context menu and the ••• overflow menu
 * (kebi-tokens-mockup.html §13/§14). A dense list of emoji + label rows on a
 * `--bg` card with a thin `--surface-2` border. Non-destructive rows come first;
 * a hairline divider is inserted automatically before the first `destructive`
 * row, which renders in `--danger`. Tapping a row runs its `onPress`, then calls
 * `onSelect` so the parent (overlay or modal) closes the menu.
 *
 * Presentational only — it knows nothing about gestures, anchoring, or blur.
 * Parents position it; this is purely the card + rows.
 */

/** Fixed menu width (px) — compact, iOS context-menu proportions. */
export const MENU_WIDTH = 240;

interface ContextMenuListProps {
  items: ContextMenuItem[];
  /** Called after an item's own `onPress` runs, to dismiss the menu. */
  onSelect: () => void;
  /**
   * Cap on the card height. When the items are taller than this (a long menu on
   * a short screen), the rows scroll inside the card. Omit for an
   * always-fits-content menu (e.g. the short overflow menu).
   */
  maxHeight?: number;
}

export function ContextMenuList({ items, onSelect, maxHeight }: ContextMenuListProps) {
  const firstDestructive = items.findIndex((item) => item.destructive);

  const rows = items.map((item, index) => (
    <View key={`${item.emoji}-${item.label}`}>
      {index === firstDestructive && index > 0 ? (
        <View className="mx-2 my-1 h-px bg-surface-2" />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.label}
        onPress={() => {
          item.onPress();
          onSelect();
        }}
        className="flex-row items-center gap-2.5 rounded-medium px-2.5 py-2 active:bg-surface"
      >
        <View className="w-5 items-center">
          <Text className="text-[15px]">{item.emoji}</Text>
        </View>
        <Text
          className={`text-small font-medium ${item.destructive ? 'text-danger' : 'text-text'}`}
        >
          {item.label}
        </Text>
      </Pressable>
    </View>
  ));

  // `overflow-hidden` keeps the scrolled rows clipped to the rounded corners.
  return (
    <View
      className="overflow-hidden rounded-large border border-surface-2 bg-bg p-1"
      style={maxHeight != null ? [SHADOW_MENU, { maxHeight }] : SHADOW_MENU}
    >
      {maxHeight != null ? (
        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {rows}
        </ScrollView>
      ) : (
        rows
      )}
    </View>
  );
}
