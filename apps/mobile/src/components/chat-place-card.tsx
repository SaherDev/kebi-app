import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ConsultCandidate, SseToolResult } from '@kebi-app/shared';
import { PRESS } from '../theme/motion';
import { Icon, type IconName } from './icon';
import { PlaceAvatar } from './place-avatar';
import { PlaceCardBody } from './place-card-body';
import { chatDetailRows, flattenCandidates, sourcePill, swapMetaLine } from './chat-place-card-data';
import { triggerHaptic } from '../lib/haptics';
import { useTranslation } from '../i18n/context';

/**
 * The chat recommendation card. Flattens the turn's tool results into candidates,
 * renders the primary pick through the shared {@link PlaceCardBody} (header +
 * source-derived pill + detail line + "kebi found this" source), and **wraps** it
 * with the namer reason, the `good pick / save it / not it` actions, and an
 * "OR SWAP TO" list of the remaining candidates. Actions are **inert** for now —
 * `POST /v1/signal` needs a `recommendation_id` the candidate doesn't carry yet.
 */
export function ChatPlaceCard({ toolResults }: { toolResults: readonly SseToolResult[] }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  // Which candidate is currently the recommendation — tapping a swap promotes it.
  const [selected, setSelected] = useState(0);

  const candidates = flattenCandidates(toolResults);
  if (candidates.length === 0) {
    return <Text className="text-small text-text-muted">{t('chat.placeCard.noMatch')}</Text>;
  }

  const primaryIndex = selected < candidates.length ? selected : 0;
  const primary = candidates[primaryIndex];
  const place = primary.place;
  const pill = sourcePill(primary.source, t);
  // Every other candidate (in original order, the old primary included) is a swap.
  const swaps = candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter((s) => s.index !== primaryIndex);

  const promote = (index: number) => {
    setSelected(index);
    triggerHaptic('swap-select');
  };
  return (
    <PlaceCardBody
      categories={place.categories}
      accessibilityLabel={place.place_name}
      name={
        <Text className="flex-1 text-body font-semibold text-text" numberOfLines={1}>
          {place.place_name}
        </Text>
      }
      pills={pill ? [pill] : undefined}
      detailRows={chatDetailRows(place, t)}
      source={{ source: 'kebi', text: t('library.source.kebi') }}
      variant="comfortable"
      expanded={expanded}
      onToggle={() => setExpanded((e) => !e)}
    >
      {primary.reason ? (
        <View className="border-t border-surface-2 pt-3">
          <Text className="text-[14px] leading-[21px] text-text-muted">{primary.reason}</Text>
        </View>
      ) : null}

      {/* Actions (inert): a filled "good pick" over an outlined save/not pair. */}
      <View className="gap-2 pt-2">
        <ActionButton variant="primary" icon="check" label={t('chat.placeCard.goodPick')} />
        <View className="flex-row gap-2">
          <ActionButton variant="outlined" icon="share-in" label={t('chat.placeCard.saveIt')} />
          <ActionButton variant="outlined" icon="close" label={t('chat.placeCard.notIt')} />
        </View>
      </View>

      {swaps.length > 0 ? (
        <View className="border-t border-surface-2 pt-1">
          <Text className="py-1 text-eyebrow font-semibold uppercase text-text-soft">
            {t('chat.placeCard.orSwapTo')}
          </Text>
          {swaps.map(({ candidate, index }, j) => (
            <SwapRow
              key={swapKey(candidate, index)}
              candidate={candidate}
              onPress={() => promote(index)}
              divided={j > 0}
              t={t}
            />
          ))}
        </View>
      ) : null}
    </PlaceCardBody>
  );
}

/** Inert action button — a placeholder until the signal contract lands. */
function ActionButton({
  variant,
  icon,
  label,
}: {
  variant: 'primary' | 'outlined';
  icon: IconName;
  label: string;
}) {
  const primary = variant === 'primary';
  return (
    <View
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`flex-row items-center justify-center gap-1.5 rounded-card ${
        primary ? 'bg-text py-3' : 'flex-1 border border-surface-2 bg-bg py-2.5'
      }`}
    >
      <Icon
        name={icon}
        size={primary ? 14 : 13}
        className={primary ? 'text-bg' : 'text-text'}
        strokeWidth={2}
      />
      <Text className={`font-semibold ${primary ? 'text-[14px] text-bg' : 'text-[13px] text-text'}`}>
        {label}
      </Text>
    </View>
  );
}

/** One tappable "or swap to" alternative — tap promotes it to the recommendation. */
function SwapRow({
  candidate,
  onPress,
  divided,
  t,
}: {
  candidate: ConsultCandidate;
  onPress: () => void;
  divided: boolean;
  t: (key: string) => string;
}) {
  const place = candidate.place;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={place.place_name}
      className={`flex-row items-center gap-3 py-2.5 ${divided ? 'border-t border-surface-2' : ''} ${PRESS}`}
    >
      {/* Decorative — the Pressable labels the row, so the avatar needs no label. */}
      <PlaceAvatar categories={place.categories} size="card" />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-[14px] font-semibold text-text" numberOfLines={1}>
          {place.place_name}
        </Text>
        <Text className="text-[12px] text-text-muted" numberOfLines={1}>
          {swapMetaLine(place, t)}
        </Text>
      </View>
      <Icon name="chevron-right" size={14} className="text-text-soft" />
    </Pressable>
  );
}

/** Stable list key for a swap candidate. */
function swapKey(candidate: ConsultCandidate, index: number): string {
  const p = candidate.place;
  return p.id ?? p.provider_id ?? `${p.place_name}-${index}`;
}
