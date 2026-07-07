import { useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { PLAN_TIERS, type PlanTier } from '@kebi-app/shared';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { IconButton } from '../components/icon-button';
import { BillingToggle } from '../components/billing-toggle';
import { PlanCard } from '../components/plan-card';
import { PLAN_CONTENT, type BillingCycle } from '../components/plans-content';
import { useProfile } from '../components/use-profile';
import { useToast } from '../components/toast-context';
import { useApiClient } from '../api/hooks';
import { changePlan } from '../api/plan';
import { useTranslation } from '../i18n/context';
import { supabase } from '../lib/supabase';

/**
 * Plans screen — "pick your vibe" (kebi-plans-mockup.html). The three tiers with
 * the current one highlighted; a monthly/yearly billing toggle swaps the shown
 * prices. Selecting another tier is a **real switch**: the gateway writes the
 * plan and re-stamps the token, so the new ADR-112 entitlements take effect on
 * the next token refresh. Optimistic like the settings name-edit — update the
 * view, PATCH, then `refreshSession`; roll back on failure. No billing/checkout.
 */
export default function PlansScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile, setLocalPlan } = useProfile();
  const toast = useToast();
  const client = useApiClient();

  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [busy, setBusy] = useState(false);

  const currentPlan = profile?.plan ?? null;

  const handleSelect = async (tier: PlanTier) => {
    if (busy || tier === currentPlan) return;
    const previous = currentPlan;
    setBusy(true);
    setLocalPlan(tier); // optimistic — the JWT stays stale until refreshSession
    try {
      await changePlan(client, tier);
      toast.show({
        tone: 'success',
        icon: 'check',
        text: t('plans.toast.planChanged', { plan: PLAN_TIERS[tier].label }),
      });
      // Mint a fresh token so the new plan/entitlements take effect immediately.
      await supabase.auth.refreshSession();
    } catch {
      if (previous) setLocalPlan(previous); // roll back
      toast.show({ tone: 'danger', icon: 'alert', text: t('plans.toast.planFailed') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenScaffold
      topBar={
        <TopBar
          left={<IconButton icon="back" label={t('common.back')} onPress={() => router.back()} />}
        />
      }
    >
      <ScrollView
        contentContainerClassName="gap-6 px-6 pb-28 pt-2"
        showsVerticalScrollIndicator={false}
      >
        {/* Eyebrow + hero + subtitle */}
        <View className="gap-1">
          <Text className="text-eyebrow font-semibold uppercase text-text-soft">
            {t('plans.eyebrow')}
          </Text>
          <Text className="font-bold text-hero text-text">{t('plans.hero')}</Text>
          <Text className="mt-1 text-small text-text-muted">{t('plans.subtitle')}</Text>
        </View>

        {/* Billing cycle */}
        <BillingToggle
          value={cycle}
          onChange={setCycle}
          monthlyLabel={t('plans.billing.monthly')}
          yearlyLabel={t('plans.billing.yearly')}
          saveLabel={t('plans.billing.save')}
        />

        {/* Plan cards */}
        <View className="gap-3">
          {PLAN_CONTENT.map((content) => (
            <PlanCard
              key={content.tier}
              content={content}
              cycle={cycle}
              isCurrent={content.tier === currentPlan}
              busy={busy}
              onSelect={() => handleSelect(content.tier)}
            />
          ))}
        </View>

        {/* Footer — visual only (no legal pages yet; link taps would be silent). */}
        <Text className="py-2 text-center text-small text-text-soft">
          {t('plans.footnote')} <Text className="underline">{t('auth.terms')}</Text> ·{' '}
          <Text className="underline">{t('auth.privacy')}</Text>
        </Text>
      </ScrollView>
    </ScreenScaffold>
  );
}
