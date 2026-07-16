import type { IdentityClaims, MovementProfile, PlanTier } from '@kebi-app/shared';

/**
 * Product claims decoded from a verified token, as a class instance (not a plain
 * object) so the identity carries a real domain object. Values are exactly what
 * the token holds — each is undefined until provisioning stamps it from
 * user_settings (ADR-045); nothing is defaulted here.
 */
export class TokenClaims implements IdentityClaims {
  readonly ai_enabled?: boolean;
  readonly plan?: PlanTier;
  readonly movement_profile?: MovementProfile;
  readonly can_curate?: boolean;
  readonly internal_id?: string;

  constructor(params: IdentityClaims) {
    if (params.ai_enabled !== undefined) this.ai_enabled = params.ai_enabled;
    if (params.plan !== undefined) this.plan = params.plan;
    if (params.movement_profile !== undefined) this.movement_profile = params.movement_profile;
    if (params.can_curate !== undefined) this.can_curate = params.can_curate;
    if (params.internal_id !== undefined) this.internal_id = params.internal_id;
  }
}
