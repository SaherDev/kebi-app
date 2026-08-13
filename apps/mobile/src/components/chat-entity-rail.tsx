import { Pressable, ScrollView, Text, View } from 'react-native';
import { CHAT_ENTITY_FALLBACK_ICON, type ChatEntity } from '@kebi-app/shared';
import { PRESS } from '../theme/motion';
import { ContextMenuTrigger } from './context-menu/context-menu-trigger';
import { useChatEntityMenuItems } from './use-chat-entity-menu-items';

/**
 * Everywhere a kebi turn named, as a horizontal rail under its answer
 * (kebi-chat-answer-options.html option c, locked). The prose is still the
 * answer — this is the tappable index of it: one chip per entity link, in the
 * order the answer mentions them, with a tap target bigger than a word in a
 * sentence.
 *
 * **Both place kinds take a slot; a web citation never does** (ADR-161 —
 * kebi-chat-web-source-options.html option a, locked). The rail indexes places
 * you can go; a source is provenance, not a destination, and its tap already
 * lives on the inline domain mention where the trust question occurs.
 *
 * Areas were excluded while an area link had
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

/** One chip per distinct place entity, in first-mention order. */
export function toRailEntities(entities: ChatEntity[]): ChatEntity[] {
  const seen = new Set<string>();
  return entities.filter((e) => {
    // A web source stays inline-only (option a, locked) — see the header note.
    if (e.kind === 'web') return false;
    // Keyed by kind as well as key: the kinds are separate id spaces, so
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
          <RailChip key={`${entity.kind}:${entity.key}`} entity={entity} onOpen={onOpen} />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * One chip. Tap opens the entity; **long-press lifts it** into the same menu the
 * library cards use — door d (kebi-curate-options.html §4), which is how an
 * insider writes about something kebi just mentioned.
 *
 * Only the chip carries the gesture, never the inline `kebi://` link in the
 * prose: a chip is a self-contained object that lifts cleanly, while a link is a
 * fragment mid-sentence, so lifting it would tear a phrase out of a paragraph —
 * on top of fighting the iOS selection loupe for the same gesture. The rail sits
 * under every answer, so no reach is lost.
 */
function RailChip({
  entity,
  onOpen,
}: {
  entity: ChatEntity;
  onOpen: (entity: ChatEntity) => void;
}) {
  const items = useChatEntityMenuItems(entity, onOpen);

  return (
    <ContextMenuTrigger
      items={items}
      accessibilityLabel={entity.name}
      renderCard={() => (
        <Pressable
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
      )}
    />
  );
}
