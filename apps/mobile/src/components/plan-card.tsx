import { View, Text, Pressable } from 'react-native';
import { PLAN_TIERS } from '@kebi-app/shared';
import { PRESS } from '../theme/motion';
import { Icon } from './icon';
import { useTranslation } from '../i18n/context';
import type { PlanContent, BillingCycle } from './plans-content';

/**
 * One plan tier card (kebi-plans-mockup.html `.plan`). Shows the emoji+label
 * (from the shared PLAN_TIERS), tagline, the price for the active billing cycle,
 * the ✓/✗ feature list, and a CTA. Two visual states: `current` (bordered, CTA
 * disabled "your current plan") and `popular` (inverted dark fill, "most picked"
 * badge). Selecting a non-current tier calls `onSelect` — a real plan switch.
 *
 * The CTA is built inline rather than via the shared Button because the popular
 * card inverts its palette (light CTA on a dark card), which the Button variants
 * don't express.
 */
interface PlanCardProps {
  content: PlanContent;
  cycle: BillingCycle;
  isCurrent: boolean;
  /** A switch is in flight — disable all cards' CTAs to avoid double-submits. */
  busy: boolean;
  onSelect: () => void;
}

export function PlanCard({ content, cycle, isCurrent, busy, onSelect }: PlanCardProps) {
  const { t } = useTranslation();
  const { tier, popular } = content;
  const meta = PLAN_TIERS[tier];
  const price = content.price[cycle];

  // Palette flips on the popular (dark-filled) card.
  const tone = {
    title: popular ? 'text-bg' : 'text-text',
    muted: popular ? 'text-bg/70' : 'text-text-muted',
    feature: popular ? 'text-bg' : 'text-text',
    featureMuted: popular ? 'text-bg/50' : 'text-text-soft',
    check: popular ? 'text-bg' : 'text-success',
    cross: popular ? 'text-bg/50' : 'text-text-soft',
    divider: popular ? 'bg-bg/15' : 'bg-surface-2',
  };

  return (
    <View
      className={`relative gap-3.5 rounded-large border-[1.5px] p-[18px] ${
        popular ? 'bg-text' : 'bg-surface'
      } ${isCurrent ? 'border-text' : 'border-transparent'}`}
    >
      {/* Tag — current wins over popular when both apply. */}
      {isCurrent || popular ? (
        <View
          className={`absolute end-3.5 rounded-full px-2.5 py-1 ${
            isCurrent ? 'bg-toast-success-bg' : 'bg-text'
          }`}
          style={{ top: -10 }}
        >
          <Text
            className={`text-eyebrow font-bold uppercase ${
              isCurrent ? 'text-toast-success-fg' : 'text-bg'
            }`}
          >
            {isCurrent ? t('plans.current') : t('plans.popular')}
          </Text>
        </View>
      ) : null}

      {/* Head */}
      <View className="gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text style={{ fontSize: 20 }}>{meta.emoji}</Text>
          <Text className={`text-subtitle font-bold ${tone.title}`}>{meta.label}</Text>
        </View>
        <Text className={`text-small ${tone.muted}`}>{t(`plans.tiers.${tier}.tagline`)}</Text>
      </View>

      {/* Price */}
      <View className="flex-row items-baseline gap-1">
        <Text className={`text-hero font-bold ${tone.title}`}>{price.amount}</Text>
        <Text className={`text-small ${tone.muted}`}>{t(price.periodKey)}</Text>
      </View>

      {/* Features — a hairline divider (a thin View, not a bordered box) sits
          above the list; the rows render on the card itself (no nested fill). */}
      <View className="gap-2">
        <View className={`h-px ${tone.divider}`} />
        {content.leadKey ? (
          <Text className={`pt-2 text-small font-medium ${tone.muted}`}>{t(content.leadKey)}</Text>
        ) : null}
        {content.features.map((feature) => (
          <View key={feature.key} className="flex-row items-center gap-2.5 pt-2">
            <Icon
              name={feature.included ? 'check' : 'close'}
              size={14}
              className={feature.included ? tone.check : tone.cross}
            />
            <Text className={`flex-1 text-small ${feature.included ? tone.feature : tone.featureMuted}`}>
              {t(`plans.tiers.${tier}.features.${feature.key}`)}
            </Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <PlanCta
        label={isCurrent ? t('plans.currentCta') : t(`plans.tiers.${tier}.cta`)}
        popular={popular}
        disabled={isCurrent || busy}
        isCurrent={isCurrent}
        onPress={onSelect}
      />
    </View>
  );
}

/** Card CTA — inverted on the popular card, muted+inert when it's the current plan. */
function PlanCta({
  label,
  popular,
  disabled,
  isCurrent,
  onPress,
}: {
  label: string;
  popular: boolean;
  disabled: boolean;
  isCurrent: boolean;
  onPress: () => void;
}) {
  // current = muted disabled pill; selectable = primary (inverted on popular).
  const box = isCurrent
    ? popular
      ? 'bg-bg/20'
      : 'bg-surface-2'
    : popular
      ? 'bg-bg'
      : 'bg-text';
  const text = isCurrent
    ? popular
      ? 'text-bg/60'
      : 'text-text-muted'
    : popular
      ? 'text-text'
      : 'text-bg';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      // Inline opacity (not a toggled className) so a disabled card never sticks dim.
      style={{ opacity: disabled && !isCurrent ? 0.4 : 1 }}
      className={`items-center justify-center rounded-card px-4 py-3 ${isCurrent ? '' : PRESS} ${box}`}
    >
      <Text className={`text-small font-semibold ${text}`}>{label}</Text>
    </Pressable>
  );
}
