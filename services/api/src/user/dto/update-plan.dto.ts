import { IsIn } from 'class-validator';
import { PLAN_TIERS, type PlanTier } from '@kebi-app/shared';

/** Valid tiers, derived from the shared plan registry — no hardcoded list. */
const PLAN_VALUES = Object.keys(PLAN_TIERS) as PlanTier[];

/**
 * PATCH /user/plan body. Switches the user's plan tier (writes
 * `user_settings.plan` and re-stamps the token claims). Gateway-local — the plan
 * is product data this repo owns, never forwarded to kebi as a body field.
 */
export class UpdatePlanDto {
  @IsIn(PLAN_VALUES)
  plan!: PlanTier;
}
