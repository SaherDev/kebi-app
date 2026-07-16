import { Fragment, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PLACE_CLAIMS_PREVIEW_COUNT, type PlaceNote } from '@kebi-app/shared';
import { Icon, type IconName } from './icon';
import { StatusPill } from './status-pill';
import { useTranslation } from '../i18n/context';

/**
 * The place page's insider-notes section — a place's ADR-127 claims
 * (kebi-place-claims-v2.html): an eyebrow header over an editorial quote list,
 * each claim hanging off a thin rule. Two calm-page rules:
 *
 * 1. Capped: only the first {@link PLACE_CLAIMS_PREVIEW_COUNT} notes show
 *    (strongest first, per contract); the rest fold behind a quiet
 *    "show all N notes" / "show less" text toggle.
 * 2. Badge said once: when EVERY note was mined from the post the user shared,
 *    the warm "from your share" pill sits next to the header, exactly once, and
 *    the rows stay clean prose. Per-row badges/labels return only when sources
 *    are mixed — then the badge is information, not wallpaper.
 *
 * The rest of the meta line shows only what a claim earns: a labelled origin
 * for expert/kebi notes (community is the unlabelled default) and the agree
 * tally once it's > 0 (0 for everyone until the vote write-path ships).
 * Renders nothing when the place has no claims.
 */

// Origins that earn a label. Community claims stay unlabelled — they're the
// section's default voice.
const SOURCE_META: Partial<Record<PlaceNote['source'], { icon: IconName; labelKey: string }>> = {
  expert: { icon: 'sparkle', labelKey: 'place.claims.expert' },
  kebi: { icon: 'note', labelKey: 'place.claims.saveReason' },
};

export function PlaceClaimsSection({ claims }: { claims: PlaceNote[] }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (claims.length === 0) return null;

  const allShared = claims.every((claim) => claim.from_shared);
  const overflow = claims.length > PLACE_CLAIMS_PREVIEW_COUNT;
  const visible = expanded ? claims : claims.slice(0, PLACE_CLAIMS_PREVIEW_COUNT);

  return (
    <View className="gap-2.5">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-eyebrow font-semibold uppercase text-text-soft">
          {t('place.sections.insiderNotes')}
        </Text>
        {allShared ? <StatusPill variant="warm">{t('place.claims.fromShared')}</StatusPill> : null}
      </View>
      <View className="gap-3.5">
        {visible.map((claim) => (
          <ClaimQuote key={claim.id} claim={claim} badgeShared={!allShared} />
        ))}
      </View>
      {overflow ? (
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={
            expanded ? t('place.claims.showLess') : t('place.claims.showAll', { count: claims.length })
          }
          className="flex-row items-center gap-1.5 self-start ps-3.5"
        >
          <Text className="text-small font-medium text-text-muted">
            {expanded
              ? t('place.claims.showLess')
              : t('place.claims.showAll', { count: claims.length })}
          </Text>
          <View style={{ transform: [{ rotate: expanded ? '-90deg' : '90deg' }] }}>
            <Icon name="chevron-right" size={12} className="text-text-muted" strokeWidth={2} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

function ClaimQuote({ claim, badgeShared }: { claim: PlaceNote; badgeShared: boolean }) {
  const { t } = useTranslation();
  const source = SOURCE_META[claim.source];

  const meta: ReactNode[] = [];
  if (badgeShared && claim.from_shared) {
    meta.push(<StatusPill variant="warm">{t('place.claims.fromShared')}</StatusPill>);
  }
  if (source) {
    meta.push(
      <View className="flex-row items-center gap-1.5">
        <Icon name={source.icon} size={12} className="text-text-muted" />
        <Text className="text-[12px] text-text-muted">{t(source.labelKey)}</Text>
      </View>,
    );
  }
  if (claim.agree_count > 0) {
    meta.push(
      <Text className="text-[12px] text-text-muted">
        {t('place.claims.agree', { count: claim.agree_count })}
      </Text>,
    );
  }

  return (
    <View className="flex-row gap-3">
      <View className="w-[2px] self-stretch rounded-full bg-surface-2" />
      <View className="flex-1 gap-1.5">
        <Text className="text-body text-text">{claim.text}</Text>
        {meta.length > 0 ? (
          <View className="flex-row flex-wrap items-center gap-2">
            {meta.map((part, i) => (
              <Fragment key={i}>
                {i > 0 ? <Text className="text-[12px] text-text-soft">·</Text> : null}
                {part}
              </Fragment>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}
