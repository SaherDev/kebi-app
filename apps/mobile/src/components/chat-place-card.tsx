import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ConsultCandidate, PlaceCore, SignalType, SseToolResult } from '@kebi-app/shared';
import { PRESS } from '../theme/motion';
import { Icon, type IconName } from './icon';
import { PlaceAvatar } from './place-avatar';
import { PlaceCardBody } from './place-card-body';
import {
  chatDetailRows,
  emptyMessage,
  flattenCandidates,
  resolveEmptyReason,
  swapMetaLine,
} from './chat-place-card-data';
import { triggerHaptic, type HapticEvent } from '../lib/haptics';
import { useApiClient } from '../api/hooks';
import { sendSignal } from '../api/signal';
import { saveUserPlace, deleteUserPlace } from '../api/library';
import { HttpError } from '../api/transports/fetch.transport';
import { useToast } from './toast-context';
import { useUpgradeToast } from './use-upgrade-toast';
import { useSavedPlaces } from './saved-places-context';
import { useTranslation } from '../i18n/context';

/** A save blocked by the free-tier library cap (ADR-112 — 403 save_limit_reached). */
function isSaveLimitReached(err: unknown): boolean {
  return (
    err instanceof HttpError &&
    err.status === 403 &&
    err.body?.detail === 'save_limit_reached'
  );
}

/**
 * The chat recommendation card. Flattens the turn's tool results into candidates,
 * renders the primary pick through the shared {@link PlaceCardBody} (header +
 * source-derived pill + detail line + "kebi found this" source), and **wraps** it
 * with the namer reason, the `good pick / save it / not it` actions, and an
 * "OR SWAP TO" list of the remaining candidates.
 *
 * Actions fire-and-forget against the gateway and confirm with a toast (no card
 * transformation): good pick / not it post a `recommendation_accepted` /
 * `_rejected` signal; save it posts the place to the library (undo deletes it).
 * Each acts on the **selected** candidate using *its* `recommendation_id`; a
 * candidate with no catalog `place.id` can't be attributed, so its actions are
 * disabled. An already-saved candidate (from `find_saved`, or matched by
 * `provider_id` in the session store) shows an inert "saved" slot.
 */
export function ChatPlaceCard({ toolResults }: { toolResults: readonly SseToolResult[] }) {
  const { t } = useTranslation();
  const client = useApiClient();
  const { show: showToast } = useToast();
  const showUpgrade = useUpgradeToast();
  const savedPlaces = useSavedPlaces();
  const [expanded, setExpanded] = useState(true);
  // Which candidate is currently the recommendation — tapping a swap promotes it.
  const [selected, setSelected] = useState(0);
  // Action keys with a request in flight — disables just that button (no double-fire).
  const [inFlight, setInFlight] = useState<ReadonlySet<string>>(() => new Set());

  const begin = useCallback(
    (k: string) => setInFlight((s) => new Set(s).add(k)),
    [],
  );
  const end = useCallback(
    (k: string) =>
      setInFlight((s) => {
        const next = new Set(s);
        next.delete(k);
        return next;
      }),
    [],
  );

  const candidates = flattenCandidates(toolResults);
  if (candidates.length === 0) {
    // No candidates — surface the reason ("no_location" is actionable, the rest
    // fall back to a generic line) rather than always saying "no match".
    const message = emptyMessage(resolveEmptyReason(toolResults), t);
    return <Text className="text-small text-text-muted">{message}</Text>;
  }

  const primaryIndex = selected < candidates.length ? selected : 0;
  const primary = candidates[primaryIndex];
  const place = primary.candidate.place;
  const recommendationId = primary.recommendationId;
  // The body needs the catalog id; without it a signal/save can't be attributed.
  const placeCoreId = place.id;
  // Already in the library: a find_saved pick, or a provider_id match this session.
  const saved = primary.candidate.source === 'saved' || savedPlaces.isSaved(place);

  // Every other candidate (in original order, the old primary included) is a swap.
  const swaps = candidates
    .map((entry, index) => ({ candidate: entry.candidate, index }))
    .filter((s) => s.index !== primaryIndex);

  const promote = (index: number) => {
    setSelected(index);
    triggerHaptic('swap-select');
  };

  /** Fire one fire-and-forget action: haptic → in-flight guard → request → toast. */
  function run(key: string, haptic: HapticEvent, op: () => Promise<void>, retry: () => void) {
    if (!placeCoreId || inFlight.has(key)) return;
    triggerHaptic(haptic);
    begin(key);
    void (async () => {
      try {
        await op();
      } catch (err) {
        if (isSaveLimitReached(err)) {
          // Retrying won't help a full library — send them to plans instead.
          showUpgrade(t('plans.limitReached.save'));
        } else {
          showToast({
            text: t('chat.placeCard.toast.error'),
            tone: 'danger',
            action: { label: t('chat.placeCard.toast.retry'), onPress: retry },
          });
        }
      } finally {
        end(key);
      }
    })();
  }

  function signal(key: string, type: SignalType, haptic: HapticEvent, toastKey: string) {
    run(
      key,
      haptic,
      async () => {
        await sendSignal(client, {
          signal_type: type,
          recommendation_id: recommendationId,
          place_core_id: placeCoreId as string,
        });
        showToast({ text: t(toastKey), icon: 'check', tone: 'success' });
      },
      () => signal(key, type, haptic, toastKey),
    );
  }

  const onGoodPick = () =>
    signal('good', 'recommendation_accepted', 'good-pick', 'chat.placeCard.toast.goodPick');
  const onNotForMe = () =>
    signal('not', 'recommendation_rejected', 'not-it', 'chat.placeCard.toast.notForMe');

  function onSaveIt() {
    if (saved) return;
    run(
      'save',
      'save-it',
      async () => {
        const userPlace = await saveUserPlace(client, {
          place_core_id: placeCoreId as string,
          recommendation_id: recommendationId,
        });
        savedPlaces.add([place]);
        showToast({
          text: t('chat.placeCard.toast.saved'),
          icon: 'check',
          tone: 'success',
          action: {
            label: t('chat.placeCard.toast.undo'),
            onPress: () => undoSave(userPlace.user_place_id, place),
          },
        });
      },
      onSaveIt,
    );
  }

  function undoSave(userPlaceId: string, target: PlaceCore) {
    void (async () => {
      try {
        await deleteUserPlace(client, userPlaceId);
        savedPlaces.remove(target);
        showToast({ text: t('chat.placeCard.toast.removed'), tone: 'neutral' });
      } catch {
        showToast({ text: t('chat.placeCard.toast.error'), tone: 'danger' });
      }
    })();
  }

  return (
    <PlaceCardBody
      categories={place.categories}
      accessibilityLabel={place.place_name}
      name={
        <Text className="flex-1 text-body font-semibold text-text" numberOfLines={1}>
          {place.place_name}
        </Text>
      }
      detailRows={chatDetailRows(place, t)}
      // No chips on the consult card — provenance lives in the source line: a
      // saved pick is the user's own ("you saved this"), otherwise kebi found it.
      source={
        primary.candidate.source === 'saved'
          ? { source: 'manual', text: t('chat.placeCard.savedByYou') }
          : { source: 'kebi', text: t('library.source.kebi') }
      }
      variant="comfortable"
      expanded={expanded}
      onToggle={() => setExpanded((e) => !e)}
    >
      {primary.candidate.reason ? (
        <View className="border-t border-surface-2 pt-3">
          <Text className="text-[14px] leading-[21px] text-text-muted">
            {primary.candidate.reason}
          </Text>
        </View>
      ) : null}

      {/* A filled "good pick" over an outlined save/not pair. The save slot shows
          an inert "saved" state once the place is in the library. */}
      <View className="gap-2 pt-2">
        <ActionButton
          variant="primary"
          icon="check"
          label={t('chat.placeCard.goodPick')}
          onPress={onGoodPick}
          disabled={!placeCoreId || inFlight.has('good')}
        />
        <View className="flex-row gap-2">
          {saved ? (
            <SavedSlot label={t('chat.placeCard.saved')} />
          ) : (
            <ActionButton
              variant="outlined"
              icon="share-in"
              label={t('chat.placeCard.saveIt')}
              onPress={onSaveIt}
              disabled={!placeCoreId || inFlight.has('save')}
            />
          )}
          <ActionButton
            variant="outlined"
            icon="close"
            label={t('chat.placeCard.notIt')}
            onPress={onNotForMe}
            disabled={!placeCoreId || inFlight.has('not')}
          />
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

/** A tappable action button. Disabled state dims via inline opacity (a toggled
 *  className sticks under NativeWind) and blocks the press. */
function ActionButton({
  variant,
  icon,
  label,
  onPress,
  disabled,
}: {
  variant: 'primary' | 'outlined';
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={{ opacity: disabled ? 0.5 : 1 }}
      className={`flex-row items-center justify-center gap-1.5 rounded-card ${PRESS} ${
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
    </Pressable>
  );
}

/** Inert "saved" slot — replaces the save button when the place is in the library. */
function SavedSlot({ label }: { label: string }) {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-card border border-surface-2 bg-surface py-2.5"
    >
      <Icon name="check" size={13} className="text-text-muted" strokeWidth={2} />
      <Text className="text-[13px] font-semibold text-text-muted">{label}</Text>
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
