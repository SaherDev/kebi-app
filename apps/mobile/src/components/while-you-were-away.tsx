import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from './icon';
import { useShareResults, type ShareResultRow } from './use-share-results';
import { useTranslation } from '../i18n/context';
import { PRESS } from '../theme/motion';

/**
 * "while you were away" — what the app has to say about links shared into it
 * from outside (kebi-while-you-were-away-mockup.html, locked).
 *
 * Sharing is silent by design: no Kebi UI, no app launch. This is the one place
 * that repays the trust that silence costs, which is why it exists at all for
 * *failures* — a save that worked needs no announcement, a save that didn't
 * does, and in a forget-flow a toast would fire while the user is still in
 * TikTok.
 *
 * The eyebrow is the constant and carries the dismiss. The group container
 * appears only at two or more rows: §Group container is explicit that a single
 * item is a row, not a card — and one share is the common case. So this is not
 * two components, it is one eyebrow whose rows gain a container when there are
 * enough of them.
 */
export function WhileYouWereAway() {
  const { t } = useTranslation();
  const { rows, dismiss, retry } = useShareResults();

  if (rows.length === 0) return null;

  return (
    <View>
      <View className="flex-row items-center gap-2 px-1 pb-2.5">
        <Text className="text-eyebrow font-semibold uppercase text-text-soft">
          {t('share.whileYouWereAway')}
        </Text>
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={t('share.dismiss')}
          hitSlop={12}
          className={`ms-auto size-5 items-center justify-center rounded-full bg-surface ${PRESS}`}
        >
          <Icon name="close" size={9} className="text-text-muted" />
        </Pressable>
      </View>

      {rows.length === 1 ? (
        <ShareRow row={rows[0]} onRetry={retry} />
      ) : (
        <View className="rounded-large bg-surface px-3">
          {rows.map((row, i) => (
            <View key={row.id}>
              {i > 0 ? <View className="h-px bg-surface-2" /> : null}
              <ShareRow row={row} onRetry={retry} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * One shared link, in whichever of its three states it is in. A row is born as
 * a skeleton and becomes a place or a failure without moving — the avatar slot
 * carries the source glyph from the first frame, so a slow video URL still says
 * *which* share is taking its time.
 */
function ShareRow({ row, onRetry }: { row: ShareResultRow; onRetry: (id: string) => void }) {
  const { t } = useTranslation();

  if (row.state === 'working') {
    return (
      <View className="flex-row items-start gap-2.5 px-1 py-2.5">
        <View className="size-[34px] items-center justify-center rounded-small bg-bg">
          <Icon name="link" size={15} className="text-text-soft" />
        </View>
        <View className="flex-1">
          {/* The url has been known since the moment it was shared, so it is not
              a skeleton. Only the place name is genuinely unknown — shimmering
              both left the row saying nothing about which share it was. */}
          <Text className="text-body font-medium text-text-muted" numberOfLines={1}>
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
        <View className="size-[34px] items-center justify-center rounded-small bg-bg">
          <Icon name="link" size={15} className="text-text-soft" />
        </View>
        <View className="flex-1">
          {/* No place exists, so the url is the name — and the failure is plain
              danger text, not a status pill: nothing here has a status. */}
          <Text className="text-body font-medium text-text-muted" numberOfLines={1}>
            {displayInput(row.rawInput)}
          </Text>
          <Text className="mt-1 text-small font-medium text-danger">
            {failureText(t, row.failureReason)}
          </Text>
        </View>
        <Pressable
          onPress={() => onRetry(row.id)}
          accessibilityRole="button"
          accessibilityLabel={t('share.tryAgain')}
          className={`self-center rounded-full border border-surface-2 px-3.5 py-1.5 ${PRESS}`}
        >
          <Text className="text-small font-semibold text-text">{t('share.tryAgain')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-row items-start gap-2.5 px-1 py-2.5">
      <View className="size-[34px] items-center justify-center rounded-small bg-bg">
        <Text className="text-[17px]">📍</Text>
      </View>
      <View className="flex-1">
        <Text className="text-body font-semibold tracking-tight text-text" numberOfLines={1}>
          {row.placeNames[0]}
        </Text>
        {row.placeNames.length > 1 ? (
          <Text className="mt-1 text-small text-text-muted">
            {t('share.andMore', { count: row.placeNames.length - 1 })}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-right" size={11} className="mt-2.5 text-text-soft" />
    </View>
  );
}

/**
 * Skeleton bar, matching the reasoning block's treatment — the one linear-paced
 * motion in the app. §Loading states is explicit that mid-content loading is a
 * skeleton and never a spinner.
 */
function Shimmer({ width }: { width: `${number}%` }) {
  const sh = useSharedValue(0);
  useEffect(() => {
    sh.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.linear }), -1, true);
    return () => cancelAnimation(sh);
  }, [sh]);
  const style = useAnimatedStyle(() => ({ opacity: 0.5 + sh.value * 0.5 }));
  return <Animated.View style={[{ width }, style]} className="h-[9px] rounded-[3px] bg-surface-2" />;
}

/** Strip the scheme so a url reads as a name rather than a protocol. */
function displayInput(raw: string): string {
  return raw.replace(/^https?:\/\//, '');
}

/**
 * Map kebi's failure_reason onto something a person would say. Unknown reasons
 * fall back to the generic line rather than leaking an enum — new reasons ship
 * from the AI repo without warning.
 */
function failureText(t: (key: string) => string, reason?: string): string {
  const known = ['unsupported_url', 'save_limit_reached', 'no_candidates'];
  return known.includes(reason ?? '') ? t(`share.failure.${reason}`) : t('share.failure.generic');
}
