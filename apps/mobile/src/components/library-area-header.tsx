import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CHAT_ENTITY_FALLBACK_ICON } from '@kebi-app/shared';
import { areaIdFromUri } from '../lib/area-link';
import { Icon } from './icon';
import { PRESS } from '../theme/motion';
import type { LibraryGroup } from '../lib/library-groups';

/**
 * A Library section header (kebi-library-filter-options.html §5, v1): icon,
 * area name, count, hairline rule — no fill, so the header stays subordinate
 * to the cards under it rather than reading as another card.
 *
 * The whole row is a **link, not a filter**. Tapping opens the area screen
 * (ADR-153) — the same screen a chat area link opens, reached the same way
 * (`areaIdFromUri` off the pre-composed `uri`), so there is one code path and a
 * header tap and a chat tap can never diverge. No `from=chat` marker: this is
 * a route-stack push, not chat surfacing a detail screen.
 *
 * The `elsewhere` bucket passes `tappable: false` — it is a data-completeness
 * gap with no area behind it, so it renders as a plain label with no chevron
 * and nothing to press.
 */

interface LibraryAreaHeaderProps {
  group: LibraryGroup;
  tappable: boolean;
  /** Rendered for the `elsewhere` bucket, which has no area name of its own. */
  label?: string;
}

export function LibraryAreaHeader({ group, tappable, label }: LibraryAreaHeaderProps) {
  const router = useRouter();
  const name = label ?? group.name;

  const body = (
    <View className="flex-row items-center gap-2 border-b border-surface-2 px-1 pb-1.5 pt-1">
      {tappable ? (
        <Text className="text-[13px] leading-none">
          {group.icon ?? CHAT_ENTITY_FALLBACK_ICON.area}
        </Text>
      ) : null}
      <Text
        className={`text-body font-bold ${tappable ? 'text-text' : 'text-text-muted'}`}
        numberOfLines={1}
      >
        {name}
      </Text>
      <Text className="text-small text-text-soft">{group.count}</Text>
      {tappable ? (
        <View className="ms-auto">
          <Icon name="chevron-right" size={11} className="text-text-soft" />
        </View>
      ) : null}
    </View>
  );

  if (!tappable) return body;

  const areaId = areaIdFromUri(group.uri);

  return (
    <Pressable
      onPress={() => {
        // A URI this build can't read has nothing to open — leave the header inert
        // rather than pushing a screen that would 404.
        if (areaId) router.push({ pathname: '/area', params: { id: areaId } });
      }}
      accessibilityRole="link"
      accessibilityLabel={name}
      className={PRESS}
    >
      {body}
    </Pressable>
  );
}
