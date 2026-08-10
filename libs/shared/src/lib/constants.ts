// Shared constants — populated as needed by feature sub-plans
import type { ChatEntityKind, PlanTier } from './types';

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

/**
 * Cap on the chat request's client-supplied `local_time` (api-contract.md →
 * POST /v1/chat). Mirrors kebi's own `max_length=40` on the field, so an
 * oversized value is rejected at the gateway instead of round-tripping to a 422.
 */
export const CHAT_LOCAL_TIME_MAX_LENGTH = 40;

/**
 * Caps on the chat request's `user_profile` block (api-contract.md → POST
 * /v1/chat, kebi ADR-154). Mirror kebi's own field limits so an oversized value
 * is rejected — or clamped, in `call_me`'s case, since it is the account display
 * name rather than something typed for kebi — instead of round-tripping to a 422.
 */
export const CALL_ME_MAX_LENGTH = 40;
export const ABOUT_ME_MAX_LENGTH = 300;

/**
 * Glyph drawn on a chat entity whose `icon` came back `null` — nullable by
 * design on both kinds (api-contract.md → ChatEntity), so every surface that
 * draws an entity needs the same fallback rather than an empty avatar. Keyed by
 * `kind` because that is all the client knows when the server picked nothing:
 * a venue is a place on a map, an area is a region.
 */
export const CHAT_ENTITY_FALLBACK_ICON: Record<ChatEntityKind, string> = {
  venue: '📍',
  area: '🗺️',
};
