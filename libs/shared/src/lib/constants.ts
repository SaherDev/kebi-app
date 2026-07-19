// Shared constants — populated as needed by feature sub-plans
import type { PlanTier } from './types';

/** Display metadata for a plan tier. All copy is lowercase per the design system. */
export interface PlanTierMeta {
  emoji: string;
  /** Human label shown on the settings plan row, e.g. "local legend". */
  label: string;
  /** Price string for the row meta, e.g. "$10/mo" or "free". */
  price: string;
}

/**
 * Plan tier → display metadata. Single source for the settings plan row so no
 * label/price is hardcoded at a call site. There is no subscription-status data
 * yet, so the row shows tier + price only (no "active" pill).
 */
export const PLAN_TIERS: Record<PlanTier, PlanTierMeta> = {
  homebody: { emoji: '🏠', label: 'homebody', price: 'free' },
  explorer: { emoji: '🧭', label: 'explorer', price: '$5/mo' },
  local_legend: { emoji: '🌟', label: 'local legend', price: '$10/mo' },
};

/**
 * How many insider notes the place page shows before folding the rest behind
 * "show all N notes" (kebi-place-claims-v2.html). Claims arrive strongest-first
 * from kebi, so the preview is the best ones.
 */
export const PLACE_CLAIMS_PREVIEW_COUNT = 3;
