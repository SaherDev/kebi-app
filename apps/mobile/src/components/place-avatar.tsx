import { View, Text } from 'react-native';
import { placeEmoji, type PlaceCategory } from '@kebi-app/shared';

/**
 * A place's avatar — the place emoji on a `--surface-2` rounded square
 * (kebi-tokens-mockup.html `.demo-avatar`). The emoji is the LLM-picked
 * `PlaceCore.icon` when present (ADR-117), else the first category that maps to
 * one (categories are ordered most-specific first), so a generic primary never
 * hides a specific later category. 📍 is the last resort — only when there is
 * no icon and no category maps (empty or all-unmapped); a caller may override
 * per place via `emoji`. Never a letter avatar. Light/dark is automatic
 * (surface-2 swaps).
 */
type AvatarSize = 'card' | 'row' | 'lg';

interface PlaceAvatarProps {
  /** The place's categories (`PlaceCore.categories`); the first drives the emoji. */
  categories?: PlaceCategory[];
  /** LLM-picked place emoji (`PlaceCore.icon`); wins over the category default. */
  icon?: string | null;
  /** Caller override; wins over both `icon` and the category default. */
  emoji?: string;
  /** `card` = 28px (in cards) · `row` = 36px (in row lists). */
  size?: AvatarSize;
  /** Accessibility label — usually the place name. */
  label?: string;
}

// Box / emoji px per documented context (design-system.md: 28px cards, 36px rows).
const SIZE: Record<AvatarSize, { box: number; emoji: number }> = {
  card: { box: 28, emoji: 16 },
  row: { box: 36, emoji: 20 },
  lg: { box: 44, emoji: 24 },
};

export function PlaceAvatar({ categories, icon, emoji, size = 'card', label }: PlaceAvatarProps) {
  const resolved = emoji ?? placeEmoji({ icon: icon ?? null, categories: categories ?? [] });
  const { box, emoji: emojiSize } = SIZE[size];
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label}
      className="items-center justify-center rounded-small bg-surface-2"
      style={{ width: box, height: box }}
    >
      <Text className="leading-none" style={{ fontSize: emojiSize }}>
        {resolved}
      </Text>
    </View>
  );
}
