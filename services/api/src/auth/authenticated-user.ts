import type { AuthUser, MovementProfile, PlanTier } from '@kebi-app/shared';

/**
 * The authenticated principal attached to a request (`req.user`). A class, not a
 * plain object, so the request carries a real domain instance. Its values are
 * read straight from the verified token's stamped claims (sourced from
 * user_settings, ADR-045) — never defaulted.
 */
export class AuthenticatedUser implements AuthUser {
  readonly id: string;
  readonly ai_enabled: boolean;
  readonly plan?: PlanTier;
  readonly movement_profile?: MovementProfile;

  constructor(params: AuthUser) {
    this.id = params.id;
    this.ai_enabled = params.ai_enabled;
    if (params.plan !== undefined) this.plan = params.plan;
    if (params.movement_profile !== undefined) {
      this.movement_profile = params.movement_profile;
    }
  }
}
