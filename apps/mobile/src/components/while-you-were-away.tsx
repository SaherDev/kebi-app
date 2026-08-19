import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from './icon';
import { ShareRow, toEntries, unfinishedFirst } from './share-result-row';
import { useShareResults, type ShareResultRow } from './use-share-results';
import { useTranslation } from '../i18n/context';
import type { Translate } from '../i18n/i18n';
import { getShareFolded, setShareFolded } from '../lib/share-fold';
import { SHARE_CARD_LIMIT } from '../lib/share-config';
import { PRESS } from '../theme/motion';

/**
 * "while you were away" — what the app has to say about links shared into it
 * from outside (kebi-while-you-were-away-mockup.html, and
 * kebi-share-show-all-options.html for the cap, the fold and the door).
 *
 * Sharing is silent by design: no Kebi UI, no app launch. This is the one place
 * that repays the trust that silence costs, which is why it exists at all for
 * *failures* — a save that worked needs no announcement, a save that didn't
 * does, and in a forget-flow a toast would fire while the user is still in
 * TikTok.
 *
 * It is a notice, not a feed. Three lines and a door: everything past the cap
 * lives on `/shares`, and every landed place is in the stash regardless. The
 * eyebrow is the constant and carries both controls — fold (not now, keep it)
 * and ✕ (off my home screen).
 */
export function WhileYouWereAway() {
  const { t } = useTranslation();
  const router = useRouter();
  const { rows, dismiss, retry } = useShareResults();
  const [folded, setFolded] = useState<boolean | null>(null);

  // Null until read, so the card never flashes open on a cold start for someone
  // who folded it yesterday.
  useEffect(() => {
    let alive = true;
    void getShareFolded().then((stored) => {
      if (alive) setFolded(stored);
    });
    return () => {
      alive = false;
    };
  }, []);

  const entries = unfinishedFirst(toEntries(rows));
  if (entries.length === 0 || folded === null) return null;

  const visible = entries.slice(0, SHARE_CARD_LIMIT);
  const hidden = entries.length - visible.length;
  const openScreen = () => router.push('/shares');

  const toggleFold = () => {
    const next = !folded;
    setFolded(next);
    void setShareFolded(next);
  };

  return (
    <View>
      <View className="flex-row items-center gap-2 px-1 pb-2.5">
        <Text className="text-eyebrow font-semibold uppercase text-text-soft">
          {t('share.whileYouWereAway')}
        </Text>
        <Pressable
          onPress={toggleFold}
          accessibilityRole="button"
          accessibilityLabel={t(folded ? 'share.unfold' : 'share.fold')}
          hitSlop={12}
          className={`ms-auto size-5 items-center justify-center rounded-full bg-surface ${PRESS}`}
        >
          <Icon name={folded ? 'chevron-down' : 'chevron-up'} size={9} className="text-text-muted" />
        </Pressable>
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={t('share.dismiss')}
          hitSlop={12}
          className={`size-5 items-center justify-center rounded-full bg-surface ${PRESS}`}
        >
          <Icon name="close" size={9} className="text-text-muted" />
        </Pressable>
      </View>

      {folded ? (
        <FoldedRow rows={rows} onPress={openScreen} />
      ) : visible.length === 1 && hidden === 0 ? (
        // §Group container: a single item is a row, not a card — and one share
        // is the common case.
        <ShareRow entry={visible[0]} onRetry={retry} />
      ) : (
        <View className="rounded-large bg-surface px-3">
          {visible.map((entry, i) => (
            <View key={entry.key}>
              {i > 0 ? <View className="h-px bg-surface-2" /> : null}
              <ShareRow entry={entry} onRetry={retry} />
            </View>
          ))}
          {hidden > 0 ? (
            // The stash's own footer language — the same row that opens the
            // library from home, pointed somewhere else.
            <Pressable
              onPress={openScreen}
              accessibilityRole="button"
              accessibilityLabel={t('share.showAll', { count: entries.length })}
              className={`flex-row items-center justify-between px-1 pb-2 pt-2.5 ${PRESS}`}
            >
              <Text className="text-body font-medium text-text">
                {t('share.showAll', { count: entries.length })}
              </Text>
              <Icon name="chevron-right" size={11} className="text-text-soft" />
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

/**
 * The card, folded: one row that says what is in it and opens the screen.
 *
 * Deliberately not a lid that only unfolds — folded, the card should still do
 * something. This way the fold and "show all" stop being two separate ideas.
 */
function FoldedRow({ rows, onPress }: { rows: ShareResultRow[]; onPress: () => void }) {
  const { t } = useTranslation();
  const summary = summarise(rows, t);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={summary}
      className={`flex-row items-center gap-2 rounded-large bg-surface px-3 py-2.5 ${PRESS}`}
    >
      <Text className="flex-1 text-body font-medium text-text" numberOfLines={1}>
        {summary}
      </Text>
      <Icon name="chevron-right" size={11} className="text-text-soft" />
    </Pressable>
  );
}

/**
 * "6 saved · 1 didn't · 1 saving" — only the parts that apply, in that order.
 * Saved leads because it is the good news and the common case; the counts are
 * what makes a folded card worth leaving folded.
 */
function summarise(rows: ShareResultRow[], t: Translate): string {
  const saved = rows.reduce((n, row) => n + row.places.length, 0);
  const failed = rows.filter((row) => row.state === 'failed').length;
  const working = rows.filter((row) => row.state === 'working').length;

  const parts: string[] = [];
  if (saved > 0) parts.push(t('share.summary.saved', { count: saved }));
  if (failed > 0) parts.push(t('share.summary.failed', { count: failed }));
  if (working > 0) parts.push(t('share.summary.working', { count: working }));
  return parts.join(' · ');
}
