import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { findPriceTag, type SavedPlaceView } from '@kebi-app/shared';
import { Icon } from './icon';
import { useTranslation } from '../i18n/context';

/** Glyphs for the meta chips — consts, not inline literals (a11y lint). */
const LIKED_GLYPH = '❤️';
const APPROVED_GLYPH = '👍';

/**
 * The place page's meta wrapper (kebi-place-mockup.html `.meta-wrapper`): a
 * `--surface` box of small chips for the place's at-a-glance facts. v1 shows the
 * user's `liked` / `went` / `approved` state when set, plus price (¥/$$/$$$). The
 * unconfirmed (`approve?`) state is the amber pill below the title; once confirmed
 * it surfaces here as the `approved` chip. The mockup's
 * live "open" dot and "8 min" distance are dropped (no live hours / no client geo
 * in v1), and the `+` add affordance belongs to the deferred edit flow. The whole
 * wrapper is hidden when there's nothing to show.
 */

function MetaChip({ leading, tone = 'text-text', children }: { leading?: ReactNode; tone?: string; children: ReactNode }) {
  return (
    <View className="flex-row items-center gap-1.5 self-start rounded-full bg-bg px-2.5 py-1.5">
      {leading}
      <Text className={`text-small font-medium ${tone}`}>{children}</Text>
    </View>
  );
}

export function PlaceMetaWrapper({ view }: { view: SavedPlaceView }) {
  const { t } = useTranslation();
  const price = findPriceTag(view.place);
  const approved = view.user_data.approved;
  const liked = view.user_data.liked === true;
  const went = view.user_data.visited;

  if (!price && !approved && !liked && !went) return null;

  return (
    <View className="flex-row flex-wrap items-center gap-1.5 rounded-large bg-surface p-2.5">
      {liked ? (
        <MetaChip leading={<Text className="text-small">{LIKED_GLYPH}</Text>} tone="text-like">
          {t('place.meta.liked')}
        </MetaChip>
      ) : null}
      {went ? (
        <MetaChip leading={<Icon name="eye" size={13} className="text-text-muted" />}>
          {t('place.meta.went')}
        </MetaChip>
      ) : null}
      {approved ? (
        <MetaChip leading={<Text className="text-small">{APPROVED_GLYPH}</Text>}>
          {t('place.meta.approved')}
        </MetaChip>
      ) : null}
      {price ? <MetaChip>{t(`library.price.${price}`)}</MetaChip> : null}
    </View>
  );
}
