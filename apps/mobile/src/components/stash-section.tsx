import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { SavedPlaceView } from '@kebi-app/shared';
import { StashRow } from './stash-row';
import { Icon } from './icon';
import { ErrorRow } from './error-row';
import { AddRow, GhostPreview } from './ghost-preview';
import { SkeletonOnSurface } from './skeleton';
import { useTranslation } from '../i18n/context';
import { PRESS } from '../theme/motion';

/**
 * The home "your stash" section (kebi-home-mockup `.group`): a single rounded
 * surface holding a title + count header, the saved-place rows (hairline-divided),
 * and a "show all" footer that opens the full library. Mirrors the `Group`
 * surface so it reads as one card — but adds the in-card header and footer the
 * mockup shows, which the plain `Group` doesn't.
 *
 * All four states (ADR-056), because "no saves" and "we don't know" are
 * different facts: rows when there are saves, a ghost preview plus the add row
 * on day one, a frozen skeleton under a retry line when the read failed, and
 * **nothing at all while it is still loading** — the section is allowed to
 * resolve to empty, so it must not promise content it may never deliver.
 */
interface StashSectionProps {
  views: SavedPlaceView[];
  /** Grand total of the user's saves; falls back to the loaded count. */
  total: number | null;
  /** Still reading — draw nothing rather than a skeleton that may vanish. */
  loading?: boolean;
  /** The read failed and we have nothing — the section says so itself. */
  error?: boolean;
  onRetry?: () => void;
  /** Opens the save sheet: the empty state's action is the last row. */
  onSave?: () => void;
}

export function StashSection({
  views,
  total,
  loading,
  error,
  onRetry,
  onSave,
}: StashSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();

  // A failed read used to render nothing at all, which made forty saves look
  // exactly like none, with nothing to retry (ADR-056). The section keeps its
  // card and reports its own failure; the rest of home is untouched.
  if (views.length === 0 && error) {
    return (
      <View className="rounded-large border border-surface-2 bg-surface p-3">
        <ErrorRow
          text={t('home.stashFailed')}
          detail={t('home.nothingLost')}
          actionLabel={t('common.retry')}
          onAction={() => onRetry?.()}
        />
        <StashRowsSkeleton frozen />
      </View>
    );
  }

  // Day one: show the shape of what lands here, with the save trigger as the
  // list's next row. Only once we actually know the stash is empty — while the
  // read is in flight the section stays absent and fades in when it lands.
  if (views.length === 0) {
    if (loading || onSave == null) return null;
    return (
      <View className="rounded-large border border-surface-2 bg-surface p-3">
        <View className="flex-row items-center gap-2.5 px-1 pb-2">
          <Text className="text-body font-medium text-text">{t('home.yourStash')}</Text>
        </View>
        <GhostPreview>
          <StashGhostRows />
        </GhostPreview>
        <View className="h-px bg-surface-2" />
        <AddRow
          label={t('home.saveFirst')}
          sublabel={t('home.saveFirstSub')}
          onPress={onSave}
        />
      </View>
    );
  }

  const count = total ?? views.length;

  return (
    <View className="rounded-large border border-surface-2 bg-surface p-3">
      <View className="flex-row items-center gap-2.5 px-1 pb-2">
        <Text className="text-body font-medium text-text">{t('home.yourStash')}</Text>
        <Text className="text-body text-text-muted">{count}</Text>
      </View>

      {views.map((view, i) => (
        <View key={view.user_data.user_place_id}>
          {i > 0 ? <View className="h-px bg-surface-2" /> : null}
          <StashRow view={view} />
        </View>
      ))}

      <Pressable
        onPress={() => router.push('/library')}
        accessibilityRole="button"
        accessibilityLabel={t('home.showAll')}
        className={`mt-1 flex-row items-center justify-between px-1 pt-3 ${PRESS}`}
      >
        <Text className="text-body font-medium text-text">{t('home.showAll')}</Text>
        <Icon name="chevron-right" size={14} className="text-text-soft" />
      </Pressable>
    </View>
  );
}

/**
 * Two stash rows' worth of shimmer, in the geometry of {@link StashRow} — the
 * avatar square, the title line, the meta line. `frozen` stops the loop and
 * dims, which is how the section reads under its own error row.
 */
export function StashRowsSkeleton({ frozen = false }: { frozen?: boolean }) {
  return (
    <View>
      {[0, 1].map((i) => (
        <View key={i}>
          {i > 0 ? <View className="h-px bg-surface-2" /> : null}
          <View className="flex-row items-center gap-3 py-2.5">
            <SkeletonOnSurface height={36} width={36} radius="small" frozen={frozen} />
            <View className="flex-1 gap-2">
              <SkeletonOnSurface height={13} width={i === 0 ? '62%' : '74%'} frozen={frozen} />
              <SkeletonOnSurface height={10} width={i === 0 ? '42%' : '52%'} frozen={frozen} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * The two rows a first-time user's stash would hold — a picture of what lands
 * here, not real data. Drawn in {@link StashRow}'s geometry and hidden from
 * assistive tech by {@link GhostPreview}, which wraps it.
 */
function StashGhostRows() {
  const { t } = useTranslation();
  const rows = [
    { emoji: '\u{1F35C}', name: t('home.ghost.first'), meta: t('home.ghost.firstMeta') },
    { emoji: '\u{2615}', name: t('home.ghost.second'), meta: t('home.ghost.secondMeta') },
  ];
  return (
    <View>
      {rows.map((row, i) => (
        <View key={row.name}>
          {i > 0 ? <View className="h-px bg-surface-2" /> : null}
          <View className="flex-row items-center gap-3 py-2.5">
            <View className="size-9 items-center justify-center rounded-small bg-bg">
              <Text className="text-[17px]">{row.emoji}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-body font-semibold text-text" numberOfLines={1}>
                {row.name}
              </Text>
              <Text className="mt-0.5 text-small text-text-muted" numberOfLines={1}>
                {row.meta}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
