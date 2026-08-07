import { Pressable, ScrollView, Text, View } from 'react-native';
import { CHAT_ENTITY_FALLBACK_ICON, type ChatEntity } from '@kebi-app/shared';
import { PRESS } from '../theme/motion';

/**
 * Everywhere a kebi turn named, as a horizontal rail under its answer
 * (kebi-chat-answer-options.html option c, locked). The prose is still the
 * answer — this is the tappable index of it: one chip per entity link, in the
 * order the answer mentions them, with a tap target bigger than a word in a
 * sentence.
 *
 * **Both kinds take a slot.** Areas were excluded while an area link had
 * nowhere to land; ADR-153 gave them a screen, so the rail now indexes every
 * destination in the turn rather than only the venues. They are drawn with the
 * *same chip* — no outline, no pill, no size of their own
 * (kebi-chat-area-chip-options.html option 1, locked): the emoji carries the
 * difference, which is how an area is identified everywhere else in the app,
 * and a distinct shape would have quietly ranked the turn's scope below the
 * venue inside it. The cost is that nothing on the chip says a tap opens a list
 * rather than a place card, so the area screen has to establish that on arrival.
 *
 * Ordering is first-mention, kinds mixed. An answer names its scope before the
 * places inside it ("a great night to be in canggu, start at Luigi's"), so the
 * area already leads in the common case — and where it doesn't, hoisting it
 * would contradict the sentence the rail is indexing.
 */

/** One chip per distinct entity, in first-mention order. */
export function toRailEntities(entities: ChatEntity[]): ChatEntity[] {
  const seen = new Set<string>();
  return entities.filter((e) => {
    // Keyed by kind as well as key: the two kinds are separate id spaces, so
    // identity is the pair, never the key alone.
    const id = `${e.kind}:${e.key}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

interface ChatEntityRailProps {
  entities: ChatEntity[];
  /** Eyebrow over the rail — pass an already-translated string. */
  label: string;
  /** Open this entity's screen — the place screen or the area screen. */
  onOpen: (entity: ChatEntity) => void;
}

export function ChatEntityRail({ entities, label, onOpen }: ChatEntityRailProps) {
  const chips = toRailEntities(entities);
  if (chips.length === 0) return null;

  return (
    <View className="gap-2">
      <Text className="text-eyebrow font-semibold uppercase text-text-soft">{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // The rail bleeds to the screen edge, so the last chip isn't flush.
        contentContainerClassName="gap-2 pe-4"
      >
        {chips.map((entity) => (
          <Pressable
            key={`${entity.kind}:${entity.key}`}
            onPress={() => onOpen(entity)}
            accessibilityRole="button"
            accessibilityLabel={entity.name}
            className={`flex-row items-center gap-2 rounded-large bg-surface py-2 pe-3 ps-2 ${PRESS}`}
          >
            <View className="size-7 items-center justify-center rounded-small bg-bg">
              <Text className="text-small">
                {entity.icon ?? CHAT_ENTITY_FALLBACK_ICON[entity.kind]}
              </Text>
            </View>
            <Text className="text-small font-semibold text-text">{entity.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
