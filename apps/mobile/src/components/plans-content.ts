import type { PlanTier } from '@kebi-app/shared';

/**
 * Display structure for the plans screen — the ordered tiers, their prices, and
 * which feature lines (with ✓/✗) each shows. All user-facing text is referenced
 * by i18n key (resolved at render), never inlined here; this file holds only the
 * structure + price values. Every line maps to a real, enforced entitlement
 * (ADR-112) — no fictional features.
 */

export interface PlanPrice {
  /** Currency amount, e.g. "$5" (presentational; no billing backend). */
  amount: string;
  /** i18n key under `plans.period` for the trailing period label. */
  periodKey: string;
}

export interface PlanFeature {
  /** i18n key under `plans.tiers.{tier}.features`. */
  key: string;
  /** ✓ included vs ✗ excluded — drives the check/cross icon + tone. */
  included: boolean;
}

export interface PlanContent {
  tier: PlanTier;
  /** The highlighted "most picked" tier. */
  popular: boolean;
  /** Monthly vs yearly price (the billing toggle picks one). */
  price: { monthly: PlanPrice; yearly: PlanPrice };
  /** Optional "everything in X, plus:" lead-in i18n key shown above the features. */
  leadKey?: string;
  features: readonly PlanFeature[];
}

const f = (key: string, included: boolean): PlanFeature => ({ key, included });

/** Ordered cheapest → priciest, matching the mockup. */
export const PLAN_CONTENT: readonly PlanContent[] = [
  {
    tier: 'homebody',
    popular: false,
    price: {
      monthly: { amount: '$0', periodKey: 'plans.period.forever' },
      yearly: { amount: '$0', periodKey: 'plans.period.forever' },
    },
    features: [
      f('saves', true),
      f('asks', true),
      f('picks', true),
      f('noTaste', false),
      f('noDiscovery', false),
    ],
  },
  {
    tier: 'explorer',
    popular: true,
    price: {
      monthly: { amount: '$5', periodKey: 'plans.period.month' },
      yearly: { amount: '$48', periodKey: 'plans.period.year' },
    },
    features: [
      f('saves', true),
      f('asks', true),
      f('taste', true),
      f('sharper', true),
      f('savedOnly', false),
    ],
  },
  {
    tier: 'local_legend',
    popular: false,
    price: {
      monthly: { amount: '$10', periodKey: 'plans.period.month' },
      yearly: { amount: '$96', periodKey: 'plans.period.year' },
    },
    leadKey: 'plans.tiers.local_legend.lead',
    features: [
      f('discover', true),
      f('matched', true),
      f('model', true),
    ],
  },
];

/** Whether the yearly column should be shown for a billing cycle. */
export type BillingCycle = 'monthly' | 'yearly';
