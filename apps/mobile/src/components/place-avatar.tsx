import { View, Text } from 'react-native';
import {
  CATEGORY_EMOJI,
  CATEGORY_EMOJI_FALLBACK,
  type PlaceCategory,
} from '@kebi-app/shared';

/**
 * A place's avatar — the category emoji on a `--surface-2` rounded square
 * (kebi-tokens-mockup.html `.demo-avatar`). The default emoji comes from the
 * primary category (`CATEGORY_EMOJI[categories[0]]`), falling back to 📍 when
 * categories are empty or unmapped; a caller may override per place via `emoji`.
 * Never a letter avatar. Light/dark is automatic (surface-2 swaps).
 */
type AvatarSize = 'card' | 'row';

interface PlaceAvatarProps {
  /** The place's categories (`PlaceCore.categories`); the first drives the emoji. */
  categories?: PlaceCategory[];
  /** Per-place override; wins over the category default. */
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
};

export function PlaceAvatar({ categories, emoji, size = 'card', label }: PlaceAvatarProps) {
  const primary = categories?.[0];
  const resolved = emoji ?? (primary ? CATEGORY_EMOJI[primary] : undefined) ?? CATEGORY_EMOJI_FALLBACK;
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
