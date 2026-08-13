import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CHAT_ENTITY_FALLBACK_ICON } from '@kebi-app/shared';
import type { AreaSubArea, AreaVenueRow as AreaVenueRowModel } from '../api/models/area';
import { PlaceAvatar } from './place-avatar';
import { Icon } from './icon';
import { areaIdFromUri } from '../lib/area-link';
import { PRESS } from '../theme/motion';

/**
 * The rows in the area screen's one body section (kebi-area-mockup.html,
 * kebi-area-country-mockup.html).
 *
 * The two shapes are the same row with different cargo, which is the point: a
 * child area and a venue are both "somewhere in here", so drilling down is one
 * gesture until it stops. What differs is what the trailing edge means — a
 * child area carries the caller's save count under that key, a venue carries
 * nothing, because a place is not a container.
 *
 * Every row is itself a tappable entity: kebi hands each one a pre-composed
 * `uri`, so a row navigates by the same rule a chat link does.
 */

/** Shared frame — avatar, two lines, optional trailing, chevron. */
function Row({
  emoji,
  name,
  detail,
  trailing,
  onPress,
}: {
  emoji: string;
  name: string;
  detail: string | null;
  trailing?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      className={`flex-row items-center gap-3 py-2.5 ${PRESS}`}
    >
      <PlaceAvatar emoji={emoji} size="row" label={name} />
      <View className="flex-1 gap-0.5">
        <Text className="text-body font-semibold text-text" numberOfLines={1}>
          {name}
        </Text>
        {detail ? (
          <Text className="text-small text-text-muted" numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing ? <Text className="text-small text-text-muted">{trailing}</Text> : null}
      <Icon name="chevron-right" size={14} className="text-text-soft" />
    </Pressable>
  );
}

/**
 * A child area — every rung above the leaf lists these. The trailing count is
 * the drill-down promise ("Bali 8" = eight of your saves are somewhere under
 * that key); it is what makes the row worth tapping rather than a dead label,
 * so it is hidden at 0 rather than printed, the same rule the header chip uses.
 */
export function AreaChildRow({ area }: { area: AreaSubArea }) {
  const router = useRouter();
  const id = areaIdFromUri(area.uri);
  if (!id) return null;

  return (
    <Row
      emoji={area.icon ?? CHAT_ENTITY_FALLBACK_ICON.area}
      name={area.name}
      detail={area.hook}
      trailing={area.saved_count > 0 ? String(area.saved_count) : undefined}
      // Push, always: a drill-down the user can retrace is worth more than a
      // shallow stack, and the same key opening twice is a path they chose.
      onPress={() => router.push({ pathname: '/area', params: { id } })}
    />
  );
}

/**
 * A saved venue — only the leaf rung lists these. `subtitle` arrives
 * server-composed and `liked`/`visited` are for accents, so nothing here is
 * recomputed from catalog data the screen doesn't have.
 */
export function AreaPlaceRow({ place }: { place: AreaVenueRowModel }) {
  const router = useRouter();

  return (
    <Row
      emoji={place.icon ?? CHAT_ENTITY_FALLBACK_ICON.venue}
      name={place.name}
      detail={place.subtitle}
      onPress={() => router.push({ pathname: '/place', params: { id: place.id } })}
    />
  );
}
