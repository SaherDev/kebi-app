import { z } from 'zod';
import type { PlanTier, UserProfile as UserProfileContract } from '@kebi-app/shared';

/**
 * Runtime model for the caller's display profile (gateway-local GET/PATCH
 * /user/profile). Same class+schema pattern as ./home: validate raw JSON at the
 * boundary and `.transform()` into a class instance (ADR-046). `name`/`email`
 * are Supabase-owned PII surfaced by the gateway; `plan` mirrors the product
 * claim. `name`/`email` may be empty strings (phone-only signup has neither).
 */

/** Plan tiers, mirroring the shared `PlanTier` union (kept in lockstep below). */
const PLAN_TIERS = ['homebody', 'explorer', 'local_legend'] as const satisfies readonly PlanTier[];

export class UserProfile implements UserProfileContract {
  readonly name: string;
  readonly email: string;
  readonly plan: PlanTier;
  readonly can_curate: boolean;

  constructor(p: UserProfileContract) {
    this.name = p.name;
    this.email = p.email;
    this.plan = p.plan;
    this.can_curate = p.can_curate;
  }
}

export const UserProfileSchema = z
  .object({
    name: z.string(),
    email: z.string(),
    plan: z.enum(PLAN_TIERS),
    // Defaulted, not required: a gateway that predates the field must not fail
    // validation and blank the whole settings screen. Absent reads as
    // not-a-curator, the same fail-closed default the guard uses.
    can_curate: z.boolean().default(false),
  })
  .transform((p) => new UserProfile(p));
