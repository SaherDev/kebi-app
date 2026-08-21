import { View } from 'react-native';
import { Skeleton, SkeletonOnSurface } from './skeleton';

/**
 * The Library's loading and failed shapes (ADR-056) — the geometry of a loaded
 * stash, so the real rows swap in without moving anything: the hero count, one
 * area header, then place cards.
 *
 * One header only. How many areas a stash has is unknown until it arrives, and
 * drawing four would be a guess the data can contradict; one is the minimum
 * that tells the truth about the layout.
 *
 * `frozen` is the failed first load: the loop stops and everything dims under
 * the screen's error row, so a retry fills the same shape rather than rebuilding.
 */

/** Card skeleton shapes — enough variety to read as a list, not a pattern. */
const CARDS = [
  { title: '52%', detail: '66%', pills: 2 },
  { title: '64%', detail: '74%', pills: 1 },
  { title: '44%', detail: '60%', pills: 0 },
] as const;

export function LibrarySkeleton({ frozen = false }: { frozen?: boolean }) {
  return (
    <View className="gap-2">
      <View className="gap-2 pb-1">
        <Skeleton height={30} width="74%" radius="small" frozen={frozen} />
      </View>

      {/* One area header: icon, name, count — above its cards, as at rest. */}
      <View className="flex-row items-center gap-2 border-b border-surface-2 px-1 pb-1.5 pt-1">
        <Skeleton height={12} width={96} frozen={frozen} />
        <Skeleton height={10} width={16} frozen={frozen} />
      </View>

      {CARDS.map((card) => (
        <View key={card.title} className="rounded-large bg-surface p-3">
          <View className="flex-row items-center gap-2.5">
            <SkeletonOnSurface height={34} width={34} radius="small" frozen={frozen} />
            <SkeletonOnSurface height={15} width={card.title} frozen={frozen} />
          </View>
          {card.pills > 0 ? (
            <View className="mt-2.5 flex-row gap-1.5">
              {Array.from({ length: card.pills }, (_, i) => (
                <SkeletonOnSurface
                  key={i}
                  height={15}
                  width={i === 0 ? 46 : 38}
                  radius="full"
                  frozen={frozen}
                />
              ))}
            </View>
          ) : null}
          <View className="mt-2">
            <SkeletonOnSurface height={12} width={card.detail} frozen={frozen} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * The search variant: a match-count line over two cards. Fewer, because a
 * search usually returns few — promising three would be its own small lie.
 */
export function LibrarySearchSkeleton({ frozen = false }: { frozen?: boolean }) {
  return (
    <View className="gap-2">
      <View className="px-1 pb-1 pt-1">
        <Skeleton height={10} width={88} frozen={frozen} />
      </View>
      {(['56%', '46%'] as const).map((width, i) => (
        <View key={width} className="rounded-large bg-surface p-3">
          <View className="flex-row items-center gap-2.5">
            <SkeletonOnSurface height={34} width={34} radius="small" frozen={frozen} />
            <SkeletonOnSurface height={15} width={width} frozen={frozen} />
          </View>
          <View className="mt-2">
            <SkeletonOnSurface height={12} width={i === 0 ? '64%' : '70%'} frozen={frozen} />
          </View>
        </View>
      ))}
    </View>
  );
}
