import { Pressable, Text } from 'react-native';
import type { PlaceCore } from '@kebi-app/shared';
import { PRESS } from '../theme/motion';
import { Icon } from './icon';
import { PlaceAvatar } from './place-avatar';
import { ContextMenuTrigger } from './context-menu/context-menu-trigger';
import { usePlaceMenuItems } from './use-place-menu-items';

/**
 * A saved-place row (kebi-tokens-mockup.html §13): `[avatar] [name] [chevron]`
 * in a `--surface` rounded-large card. The first consumer of the long-press
 * context menu — wrapped in `ContextMenuTrigger`, it lifts on long-press and
 * shows the place actions. A short tap calls `onPress` (navigate to the place).
 */

interface PlaceCardProps {
  place: PlaceCore;
  /** Tap (not long-press) — usually navigates to the place page. */
  onPress?: () => void;
}

export function PlaceCard({ place, onPress }: PlaceCardProps) {
  const items = usePlaceMenuItems(place);

  return (
    <ContextMenuTrigger
      items={items}
      accessibilityLabel={place.place_name}
      renderCard={() => (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={place.place_name}
          className={`flex-row items-center gap-2.5 rounded-large bg-surface px-3.5 py-3 ${PRESS}`}
        >
          <PlaceAvatar categories={place.categories} icon={place.icon} size="row" label={place.place_name} />
          <Text className="flex-1 text-body font-medium text-text" numberOfLines={1}>
            {place.place_name}
          </Text>
          <Icon name="chevron-right" size={16} className="text-text-soft" />
        </Pressable>
      )}
    />
  );
}
