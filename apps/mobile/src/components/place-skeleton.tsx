import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Skeleton, SkeletonOnSurface } from './skeleton';
import { useTranslation } from '../i18n/context';

/**
 * The place screen with nothing seeded — a deep link, the share extension, or a
 * back-stack entry, where all we hold is an id (ADR-056).
 *
 * Unlike the area screen, the title shimmers too: nothing in the link carries
 * the place's name. And there is **no top pill**: edit and ••• act on a
 * `user_place_id`, so drawing them before we know whether this place is saved
 * would mean removing them a moment later.
 *
 * `error` renders above a `frozen` body — the failed load keeps the shape it
 * promised, so a successful retry fills it in rather than rebuilding the screen.
 */
interface PlaceSkeletonProps {
  frozen?: boolean;
  error?: ReactNode;
}

export function PlaceSkeleton({ frozen = false, error }: PlaceSkeletonProps) {
  const { t } = useTranslation();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerClassName="gap-4 px-6 pb-24 pt-2"
    >
      <Skeleton height={10} width="44%" frozen={frozen} />
      <Skeleton height={22} width="68%" radius="small" frozen={frozen} />

      {error}

      <View className="flex-row flex-wrap gap-1.5 rounded-large bg-surface p-2.5">
        <SkeletonOnSurface height={28} width={104} radius="full" frozen={frozen} />
        <SkeletonOnSurface height={28} width={82} radius="full" frozen={frozen} />
      </View>

      {/* Service buttons — map / share / save, whichever this place supports. */}
      <View className="flex-row flex-wrap gap-2">
        <Skeleton height={38} width={112} radius="card" frozen={frozen} />
        <Skeleton height={38} width={96} radius="card" frozen={frozen} />
      </View>

      <View>
        <Text className="text-eyebrow font-semibold uppercase text-text-soft">
          {t('place.sections.atmosphere')}
        </Text>
        <View className="mt-2.5 flex-row flex-wrap gap-1.5">
          <Skeleton height={30} width={92} radius="full" frozen={frozen} />
          <Skeleton height={30} width={78} radius="full" frozen={frozen} />
          <Skeleton height={30} width={110} radius="full" frozen={frozen} />
        </View>
      </View>

      <View>
        <Text className="text-eyebrow font-semibold uppercase text-text-soft">
          {t('place.sections.features')}
        </Text>
        <View className="mt-2.5 flex-row flex-wrap gap-1.5">
          <Skeleton height={30} width={104} radius="full" frozen={frozen} />
          <Skeleton height={30} width={86} radius="full" frozen={frozen} />
        </View>
      </View>
    </ScrollView>
  );
}
