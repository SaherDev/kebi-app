import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { derivePills, placeDisplayName, type SavedPlaceView } from '@kebi-app/shared';
import { PlaceAvatar } from './place-avatar';
import { LibraryPill } from './library-pill';
import { Icon } from './icon';
import { formatDetailLine } from './place-card-body';
import { usePlaceDetail } from './place-detail-context';
import { usePlaceActions } from './place-actions-context';
import { useTranslation } from '../i18n/context';
import { PRESS } from '../theme/motion';

/**
 * A compact saved-place row for the home "your stash" group (kebi-home-mockup
 * `.group-row`). Flat (no own card surface) so it sits inside the group's shared
 * surface — unlike `LibraryPlaceCard`, which draws its own card. It carries the
 * same data the library card shows today: real status pills ({@link derivePills})
 * and the `cuisine · price · area` detail line ({@link formatDetailLine}) — no
 * travel time. Effective state comes through `resolve` so an optimistic action
 * taken elsewhere reflects here too; tapping opens the place detail (path A).
 */
interface StashRowProps {
  view: SavedPlaceView;
}

export function StashRow({ view }: StashRowProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const placeDetail = usePlaceDetail();
  const { resolve } = usePlaceActions();

  const { userData, removed } = resolve(view);
  if (removed) return null; // optimistically gone after a forget

  const { place } = view;
  const title = placeDisplayName(view);
  const pills = derivePills(userData);
  const detail = formatDetailLine(place, t);

  const openPlace = () => {
    placeDetail.set(view);
    router.push('/place');
  };

  return (
    <Pressable
      onPress={openPlace}
      accessibilityRole="button"
      accessibilityLabel={title}
      className={`flex-row items-center gap-3 py-2.5 ${PRESS}`}
    >
      <PlaceAvatar categories={place.categories} icon={place.icon} size="row" label={title} />
      <View className="flex-1 gap-1">
        <Text className="text-body font-semibold text-text" numberOfLines={1}>
          {title}
        </Text>
        {pills.length > 0 ? (
          <View className="flex-row flex-wrap items-center gap-1.5">
            {pills.map((p) =>
              p.glyph ? (
                <LibraryPill
                  key={p.kind}
                  tone={p.tone}
                  glyph={p.glyph}
                  accessibilityLabel={t(`library.pill.${p.kind}`)}
                />
              ) : (
                <LibraryPill key={p.kind} tone={p.tone} label={t(`library.pill.${p.kind}`)} />
              ),
            )}
          </View>
        ) : null}
        {detail ? (
          <Text className="text-small text-text-muted" numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-right" size={16} className="text-text-soft" />
    </Pressable>
  );
}
