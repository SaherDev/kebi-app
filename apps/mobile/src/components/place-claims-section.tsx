import { Fragment, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import type { PlaceNote } from '@kebi-app/shared';
import { Icon, type IconName } from './icon';
import { StatusPill } from './status-pill';
import { useTranslation } from '../i18n/context';

/**
 * The place page's insider-notes section — a place's ADR-127 claims
 * (kebi-place-claims-options.html, option A "quiet quotes"): an eyebrow header
 * over an editorial quote list, each claim hanging off a thin rule with a small
 * meta line beneath. The meta line shows only what a claim earns: a warm
 * "from what you shared" pill (`from_shared`), a labelled origin for
 * expert/kebi notes (community is the unlabelled default), and the agree tally
 * once it's > 0 (0 for everyone until the vote write-path ships). Renders
 * nothing when the place has no claims.
 */

// Origins that earn a label. Community claims stay unlabelled — they're the
// section's default voice.
const SOURCE_META: Partial<Record<PlaceNote['source'], { icon: IconName; labelKey: string }>> = {
  expert: { icon: 'sparkle', labelKey: 'place.claims.expert' },
  kebi: { icon: 'note', labelKey: 'place.claims.saveReason' },
};

export function PlaceClaimsSection({ claims }: { claims: PlaceNote[] }) {
  const { t } = useTranslation();
  if (claims.length === 0) return null;

  return (
    <View className="gap-2.5">
      <Text className="text-eyebrow font-semibold uppercase text-text-soft">
        {t('place.sections.insiderNotes')}
      </Text>
      <View className="gap-3.5">
        {claims.map((claim) => (
          <ClaimQuote key={claim.id} claim={claim} />
        ))}
      </View>
    </View>
  );
}

function ClaimQuote({ claim }: { claim: PlaceNote }) {
  const { t } = useTranslation();
  const source = SOURCE_META[claim.source];

  const meta: ReactNode[] = [];
  if (claim.from_shared) {
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
