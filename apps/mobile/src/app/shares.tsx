import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { IconButton } from '../components/icon-button';
import { Icon } from '../components/icon';
import { ConfirmSheet } from '../components/confirm-sheet';
import { SOURCE_ICON } from '../components/source-icon';
import {
  ShareRow,
  Shimmer,
  displayInput,
  failureText,
} from '../components/share-result-row';
import { useShareResults, type ShareResultRow } from '../components/use-share-results';
import { formatClockTime, formatRelativeTime } from '../lib/format-relative-time';
import { SHARE_HISTORY_DAYS } from '../lib/share-config';
import { useTranslation } from '../i18n/context';
import { PRESS } from '../theme/motion';

/**
 * Everything shared into kebi from outside, grouped by share
 * (kebi-share-show-all-options.html §3, option b).
 *
 * The home card is a notice capped at three lines; this is the whole of it. The
 * grouping is the point: one TikTok often yields four places, and a flat list
 * turns that into four unrelated saves with no way to tell which video any of
 * them came from. Here the link is the heading and its places sit under it, so
 * a share reads as what it produced — and a failure reads as an empty group,
 * which is exactly what it is.
 *
 * Includes shares already cleared off home. ✕ there means "not on my home
 * screen", not "never happened"; {@link SHARE_HISTORY_DAYS} does the forgetting,
 * and "clear" here is the only real delete.
 */
export default function SharesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { rows, clear, retry } = useShareResults({ includeDismissed: true });
  const [confirming, setConfirming] = useState(false);

  // Newest first — the reverse of storage order, which appends.
  const ordered = [...rows].sort((a, b) => b.sharedAt - a.sharedAt);
  const places = rows.reduce((n, row) => n + row.places.length, 0);

  const back = <IconButton icon="back" label={t('common.back')} onPress={() => router.back()} />;

  return (
    <ScreenScaffold
      topBar={
        <TopBar
          left={back}
          right={
            ordered.length > 0 ? (
              <Pressable
                onPress={() => setConfirming(true)}
                accessibilityRole="button"
                accessibilityLabel={t('share.clear')}
                hitSlop={10}
                className={`px-1 ${PRESS}`}
              >
                <Text className="text-body font-medium text-text-muted">{t('share.clear')}</Text>
              </Pressable>
            ) : undefined
          }
        />
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-6 pb-28 pt-2"
      >
        <View className="gap-1">
          <Text className="font-bold text-hero text-text">{t('share.recentActivity')}</Text>
          {ordered.length > 0 ? (
            <Text className="text-small text-text-muted">
              {t('share.historySubtitle', { links: ordered.length, places })}
            </Text>
          ) : null}
        </View>

        {ordered.length === 0 ? (
          <Text className="text-body text-text-muted">{t('share.historyEmpty')}</Text>
        ) : (
          ordered.map((row, i) => (
            <View key={row.id} className="gap-2">
              {/* A day heading only when the day changes — most of this list is
                  one evening's sharing, and repeating "today" above every group
                  would say nothing. */}
              {i === 0 || dayOf(row) !== dayOf(ordered[i - 1]) ? (
                <Text className="pt-2 text-eyebrow font-semibold uppercase text-text-soft">
                  {dayOf(row)}
                </Text>
              ) : null}
              <ShareGroup row={row} onRetry={retry} />
            </View>
          ))
        )}
      </ScrollView>

      <ConfirmSheet
        open={confirming}
        title={t('share.clearTitle')}
        body={t('share.clearBody')}
        confirmLabel={t('share.clear')}
        onConfirm={() => {
          clear();
          setConfirming(false);
        }}
        onClose={() => setConfirming(false)}
      />
    </ScreenScaffold>
  );
}

/**
 * One share: what was shared, then what it became.
 *
 * The heading carries the identity — source mark, time, and the caption or link
 * — so the rows underneath are free to be nothing but places. That is why the
 * landed rows here are the same component the home card uses, while the working
 * and failed states get a shorter treatment: their label and link already live
 * in the heading above them.
 */
function ShareGroup({ row, onRetry }: { row: ShareResultRow; onRetry: (id: string) => void }) {
  const { t } = useTranslation();

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-2 px-1">
        <View className="size-[22px] items-center justify-center rounded-small bg-surface">
          <Icon name={SOURCE_ICON[row.source]} size={11} className="text-text-soft" />
        </View>
        <Text className="flex-1 text-small text-text-muted" numberOfLines={1}>
          {formatClockTime(new Date(row.sharedAt))} · {row.title ?? displayInput(row.rawInput)}
        </Text>
      </View>

      <View className="rounded-large bg-surface px-3">
        {row.state === 'landed' ? (
          row.places.map((place, i) => (
            <View key={`${row.id}:${i}`}>
              {i > 0 ? <View className="h-px bg-surface-2" /> : null}
              <ShareRow entry={{ key: `${row.id}:${i}`, row, place }} onRetry={onRetry} />
            </View>
          ))
        ) : row.state === 'working' ? (
          <View className="gap-2 px-1 py-3">
            <Shimmer width="52%" />
            <Shimmer width="34%" />
          </View>
        ) : (
          <View className="flex-row items-center gap-2.5 px-1 py-2.5">
            <View className="flex-1">
              <Text className="text-body font-semibold text-text">{t('share.nothingSaved')}</Text>
              <Text className="mt-0.5 text-small font-medium text-danger">
                {failureText(t, row.failureReason)}
              </Text>
            </View>
            <Pressable
              onPress={() => onRetry(row.id)}
              accessibilityRole="button"
              accessibilityLabel={t('share.tryAgain')}
              hitSlop={10}
              className={`size-[30px] items-center justify-center ${PRESS}`}
            >
              <Icon name="refresh" size={15} className="text-text-muted" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * "today" / "yesterday" / "mon" / "jun 12" — the day half of the app's recall
 * timestamp, reused so this list speaks in the same clock as everything else.
 */
function dayOf(row: ShareResultRow): string {
  return formatRelativeTime(new Date(row.sharedAt).toISOString()).split(',')[0];
}
