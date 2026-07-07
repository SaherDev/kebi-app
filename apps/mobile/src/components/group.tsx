import { Children, type ReactNode } from 'react';
import { View, Text } from 'react-native';

/**
 * The rounded surface that wraps any list of 2+ related items — place cards,
 * settings rows, swap suggestions (kebi-tokens-mockup.html `.group-demo`). A
 * `--surface` card with hairline `--surface-2` dividers between rows and an
 * optional uppercase eyebrow header above it (`.section-title`).
 *
 * Single-responsibility: Group provides the surface + dividers + eyebrow only;
 * callers supply the row content as children. Don't use it for a single item (a
 * lone item is a row, not a card) and don't nest groups. Light/dark is
 * automatic via the CSS-variable tokens.
 */
interface GroupProps {
  /** Optional section eyebrow, rendered uppercase above the surface. */
  eyebrow?: string;
  /** Row elements — a 1px divider is inserted between each pair. */
  children: ReactNode;
}

export function Group({ eyebrow, children }: GroupProps) {
  const rows = Children.toArray(children);
  return (
    <View>
      {eyebrow ? (
        <Text className="mb-2 ps-1 text-eyebrow font-semibold uppercase text-text-soft">
          {eyebrow}
        </Text>
      ) : null}
      <View className="rounded-large border border-surface-2 bg-surface p-3">
        {rows.map((row, i) => (
          // Stable order, static list — index key is appropriate here.
          // eslint-disable-next-line react/no-array-index-key
          <View key={i}>
            {i > 0 ? <View className="h-px bg-surface-2" /> : null}
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}
