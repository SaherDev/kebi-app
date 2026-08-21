import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { CHAT_ENTITY_FALLBACK_ICON } from '@kebi-app/shared';
import { Skeleton, SkeletonOnSurface } from './skeleton';
import { useTranslation } from '../i18n/context';

/**
 * The area screen while it loads, and while it holds a failure (ADR-056).
 *
 * The title is **real from the first frame** when the link that opened the
 * screen carried it — every caller (a library section header, an area row, a
 * chat rail chip) already holds the name and emoji, so shimmering them would be
 * hiding something we have. Everything the server still owes shimmers in its
 * own slot; the section eyebrows stay solid, because they are static labels.
 *
 * `error` is rendered under the title, above a `frozen` body — the failure
 * reads as a pause in the same screen rather than a different one.
 */
interface AreaSkeletonProps {
  /** The name the link carried, if any. */
  name?: string;
  /** The emoji the link carried, if any. */
  icon?: string;
  frozen?: boolean;
  error?: ReactNode;
}

/** Summary paragraph line widths — three lines of prose, tapering. */
const SUMMARY_LINES = ['100%', '96%', '62%'] as const;

export function AreaSkeleton({ name, icon, frozen = false, error }: AreaSkeletonProps) {
  const { t } = useTranslation();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerClassName="gap-4 px-6 pb-24 pt-2"
    >
      {/* Breadcrumb — always the server's, so always a skeleton. */}
      <View className="flex-row items-center gap-1.5">
        <Skeleton height={10} width={56} frozen={frozen} />
        <Text className="text-small text-text-soft">›</Text>
        <Skeleton height={10} width={38} frozen={frozen} />
      </View>

      {name ? (
        <Text className="text-title font-bold leading-tight text-text">
          {icon ?? CHAT_ENTITY_FALLBACK_ICON.area} {name}
        </Text>
      ) : (
        <Skeleton height={22} width="58%" radius="small" frozen={frozen} />
      )}

      {error}

      <View className="gap-4">
        {/* Meta chips wrapper. */}
        <View className="flex-row flex-wrap gap-1.5 rounded-large bg-surface p-2.5">
          <SkeletonOnSurface height={28} width={96} radius="full" frozen={frozen} />
          <SkeletonOnSurface height={28} width={74} radius="full" frozen={frozen} />
        </View>

        {/* Summary — the one thing on the screen only kebi could have written. */}
        <View className="gap-2">
          {SUMMARY_LINES.map((width) => (
            <Skeleton key={width} height={14} width={width} frozen={frozen} />
          ))}
        </View>

        <View>
          <Text className="text-eyebrow font-semibold uppercase text-text-soft">
            {t('area.bestFor')}
          </Text>
          <View className="mt-2.5 flex-row flex-wrap gap-1.5">
            <Skeleton height={30} width={88} radius="full" frozen={frozen} />
            <Skeleton height={30} width={112} radius="full" frozen={frozen} />
            <Skeleton height={30} width={76} radius="full" frozen={frozen} />
          </View>
        </View>

        <View>
          <Text className="text-eyebrow font-semibold uppercase text-text-soft">
            {t('area.sections.savedPlaces')}
          </Text>
          <View className="mt-2.5">
            {[0, 1].map((i) => (
              <View
                key={i}
                className="flex-row items-center gap-3 border-b border-surface-2 py-3"
              >
                <Skeleton height={32} width={32} radius="small" frozen={frozen} />
                <View className="flex-1 gap-2">
                  <Skeleton height={12} width={i === 0 ? '52%' : '64%'} frozen={frozen} />
                  <Skeleton height={10} width={i === 0 ? '34%' : '28%'} frozen={frozen} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
