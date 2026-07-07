import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { PlaceTag } from '@kebi-app/shared';
import { PlaceChip } from './place-chip';
import { Icon } from './icon';

/**
 * A titled chip section on the place page (kebi-place-mockup.html `.tag-section`):
 * an uppercase eyebrow header above a wrapping row of {@link PlaceChip}s. Reused
 * for the atmosphere/features sections (always open) and the catch-all "others"
 * section (`collapsible` — hidden behind a tappable header with a chevron, so it
 * doesn't clutter the page until expanded). Renders nothing when there are no
 * tags. The `+` add affordance from the mockup belongs to the deferred edit flow.
 */

interface PlaceTagSectionProps {
  /** Already-translated, lowercase section title (rendered uppercase). */
  header: string;
  tags: PlaceTag[];
  /** Collapse behind a tappable header, closed by default (the "others" catch-all). */
  collapsible?: boolean;
}

export function PlaceTagSection({ header, tags, collapsible = false }: PlaceTagSectionProps) {
  const [expanded, setExpanded] = useState(false);
  if (tags.length === 0) return null;

  const chips = (
    <View className="flex-row flex-wrap items-center gap-1.5">
      {tags.map((tag, i) => (
        <PlaceChip key={`${tag.type}-${tag.value}-${i}`} tag={tag} />
      ))}
    </View>
  );

  const headerText = (
    <Text className="text-eyebrow font-semibold uppercase text-text-soft">{header}</Text>
  );

  if (!collapsible) {
    return (
      <View className="gap-2.5">
        {headerText}
        {chips}
      </View>
    );
  }

  return (
    <View className="gap-2.5">
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        accessibilityRole="button"
        accessibilityLabel={header}
        accessibilityState={{ expanded }}
        className="flex-row items-center gap-1.5 self-start"
      >
        {headerText}
        <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
          <Icon name="chevron-right" size={12} className="text-text-soft" strokeWidth={2} />
        </View>
      </Pressable>
      {expanded ? chips : null}
    </View>
  );
}
