import { Pressable, ScrollView, Text, View } from 'react-native';
import { CHAT_ENTITY_FALLBACK_ICON, type ChatEntity } from '@kebi-app/shared';
import { PRESS } from '../theme/motion';

/**
 * The venues a kebi turn named, as a horizontal rail under its answer
 * (kebi-chat-answer-options.html option c, locked). The prose is still the
 * answer — this is the place-shaped index of it: one chip per venue link, in
 * the order the answer mentions them, with a tap target bigger than a word in
 * a sentence.
 *
 * Venues only. An `area` entity is context for the sentence ("a great night to
 * be in canggu"), not somewhere to go, so it stays a link in the text and never
 * takes a slot in the rail.
 */

/** One chip per distinct venue, in first-mention order. */
export function toRailEntities(entities: ChatEntity[]): ChatEntity[] {
  const seen = new Set<string>();
  return entities.filter((e) => {
    if (e.kind !== 'venue' || seen.has(e.key)) return false;
    seen.add(e.key);
    return true;
  });
}

interface ChatEntityRailProps {
  entities: ChatEntity[];
  /** Eyebrow over the rail — pass an already-translated string. */
  label: string;
  /** Open this venue's card. */
  onOpen: (entity: ChatEntity) => void;
}

export function ChatEntityRail({ entities, label, onOpen }: ChatEntityRailProps) {
  const venues = toRailEntities(entities);
  if (venues.length === 0) return null;

  return (
    <View className="gap-2">
      <Text className="text-eyebrow font-semibold uppercase text-text-soft">{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // The rail bleeds to the screen edge, so the last chip isn't flush.
        contentContainerClassName="gap-2 pe-4"
      >
        {venues.map((venue) => (
          <Pressable
            key={venue.key}
            onPress={() => onOpen(venue)}
            accessibilityRole="button"
            accessibilityLabel={venue.name}
            className={`flex-row items-center gap-2 rounded-large bg-surface py-2 pe-3 ps-2 ${PRESS}`}
          >
            <View className="size-7 items-center justify-center rounded-small bg-bg">
              <Text className="text-small">
                {venue.icon ?? CHAT_ENTITY_FALLBACK_ICON[venue.kind]}
              </Text>
            </View>
            <Text className="text-small font-semibold text-text">{venue.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
