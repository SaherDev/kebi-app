import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from './icon';
import { SOURCE_ICON } from './source-icon';
import { PlaceAvatar } from './place-avatar';
import type { ShareResultRow } from './use-share-results';
import { useTranslation } from '../i18n/context';
import { PRESS } from '../theme/motion';

/** One rendered line: a share in progress or failed, or one place it saved. */
export interface ShareEntry {
  key: string;
  row: ShareResultRow;
  place: ShareResultRow['places'][number] | null;
}

/**
 * Expand shares into the lines that represent them. A share that saved four
 * places is four lines, not one with "and 3 more" — this is the surface whose
 * whole job is saying what landed.
 */
export function toEntries(rows: ShareResultRow[]): ShareEntry[] {
  return rows.flatMap<ShareEntry>((row) =>
    row.state === 'landed'
      ? row.places.map((place, i) => ({ key: `${row.id}:${i}`, row, place }))
      : [{ key: row.id, row, place: null }],
  );
}

/**
 * Order for the home card, where only three lines survive: anything unfinished
 * first, then places, each newest first.
 *
 * Strict chronology was the alternative and it loses the wrong row — a failure
 * that scrolls off the cap is the only line on this card that can actually be
 * lost, since every landed place is also sitting in the stash.
 */
export function unfinishedFirst(entries: ShareEntry[]): ShareEntry[] {
  const rank = (entry: ShareEntry) => (entry.row.state === 'landed' ? 1 : 0);
  return [...entries].sort(
    (a, b) => rank(a) - rank(b) || b.row.sharedAt - a.row.sharedAt,
  );
}

/**
 * One shared link, in whichever of its three states it is in. A row is born as
 * a skeleton and becomes a place or a failure without moving — the avatar slot
 * carries the source glyph from the first frame, so a slow video URL still says
 * *which* share is taking its time.
 */
export function ShareRow({
  entry,
  onRetry,
}: {
  entry: ShareEntry;
  onRetry: (id: string) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { row, place } = entry;

  if (row.state === 'working') {
    return (
      <View className="flex-row items-start gap-2.5 px-1 py-2.5">
        <View className="size-[34px] items-center justify-center rounded-small bg-bg">
          <Icon name={SOURCE_ICON[row.source]} size={15} className="text-text-soft" />
        </View>
        <View className="flex-1">
          {/* Both known since the share happened, so neither is a skeleton. Only
              the place name is genuinely unknown, and only that shimmers. */}
          <Text className="text-body font-semibold text-text" numberOfLines={1}>
            {row.label}
          </Text>
          <Text className="mt-0.5 text-small text-text-soft" numberOfLines={1}>
            {displayInput(row.rawInput)}
          </Text>
          <View className="mt-2">
            <Shimmer width="46%" />
          </View>
        </View>
      </View>
    );
  }

  if (row.state === 'failed') {
    return (
      <View className="flex-row items-start gap-2.5 px-1 py-2.5">
        {/* Same source mark as every other state — the generic link glyph here
            was a leftover, not a decision. */}
        <View className="size-[34px] items-center justify-center rounded-small bg-bg">
          <Icon name={SOURCE_ICON[row.source]} size={15} className="text-text-soft" />
        </View>
        <View className="flex-1">
          <Text className="text-body font-semibold text-text" numberOfLines={1}>
            {row.label}
          </Text>
          <Text className="mt-0.5 text-small text-text-soft" numberOfLines={1}>
            {displayInput(row.rawInput)}
          </Text>
          {/* Plain danger text, not a status pill: nothing here has a status. */}
          <Text className="mt-1 text-small font-medium text-danger">
            {failureText(t, row.failureReason)}
          </Text>
        </View>
        {/* The app's existing action language (kebi-toasts-mockup .toast-action):
            borderless, no background. A bordered pill competed with the row
            divider and sat where every other row shows a chevron. */}
        <Pressable
          onPress={() => onRetry(row.id)}
          accessibilityRole="button"
          accessibilityLabel={t('share.tryAgain')}
          hitSlop={10}
          className={`size-[30px] self-center items-center justify-center ${PRESS}`}
        >
          <Icon name="refresh" size={15} className="text-text-muted" />
        </Pressable>
      </View>
    );
  }

  if (!place) return null;

  // A landed share is a place, so it behaves like one: same avatar as the stash,
  // same chevron, same destination.
  const openPlace = () => {
    if (!place.id) return;
    router.push({ pathname: '/place', params: { id: place.id } });
  };

  return (
    <Pressable
      onPress={openPlace}
      disabled={!place.id}
      accessibilityRole="button"
      accessibilityLabel={place.name}
      className={`flex-row items-center gap-2.5 px-1 py-2.5 ${PRESS}`}
    >
      <PlaceAvatar
        categories={place.categories as never}
        icon={place.icon}
        size="row"
        label={place.name}
      />
      <View className="flex-1">
        <Text className="text-body font-semibold tracking-tight text-text" numberOfLines={1}>
          {place.name}
        </Text>
      </View>
      <Icon name="chevron-right" size={11} className="text-text-soft" />
    </Pressable>
  );
}

/**
 * Skeleton bar, matching the reasoning block's treatment — the one linear-paced
 * motion in the app. §Loading states is explicit that mid-content loading is a
 * skeleton and never a spinner.
 */
export function Shimmer({ width }: { width: `${number}%` }) {
  const sh = useSharedValue(0);
  useEffect(() => {
    sh.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.linear }), -1, true);
    return () => cancelAnimation(sh);
  }, [sh]);
  const style = useAnimatedStyle(() => ({ opacity: 0.5 + sh.value * 0.5 }));
  return <Animated.View style={[{ width }, style]} className="h-[9px] rounded-[3px] bg-surface-2" />;
}

/** Strip the scheme so a url reads as a name rather than a protocol. */
export function displayInput(raw: string): string {
  return raw.replace(/^https?:\/\//, '');
}

/**
 * Map kebi's failure_reason onto something a person would say. Unknown reasons
 * fall back to the generic line rather than leaking an enum — new reasons ship
 * from the AI repo without warning.
 */
export function failureText(t: (key: string) => string, reason?: string): string {
  const known = ['unsupported_url', 'save_limit_reached', 'no_candidates'];
  return known.includes(reason ?? '') ? t(`share.failure.${reason}`) : t('share.failure.generic');
}
