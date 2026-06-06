import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NormalizedIdentity, PlanTier } from '@kebi-app/shared';
import { IDENTITY_PROVIDER } from './identity-provider.interface';
import type { IdentityProvider } from './identity-provider.interface';
import { IDENTITY_METADATA_WRITER } from './identity-metadata.writer';
import type { IdentityMetadataWriter } from './identity-metadata.writer';
import { UserIdentityService } from './user-identity.service';

/**
 * Provisions an authenticated identity into our system — the explicit work that
 * used to be a middleware side-effect. Called once on sign-in by
 * `POST /auth/login`.
 *
 * It always ensures the internal User row exists (find-or-create) — it never
 * trusts the token's `internal_id` claim alone, because the row could be missing
 * while the token still carries the claim (e.g. after a DB reset). It re-stamps
 * `internal_id` (+ plan/ai_enabled/movement_profile) into the provider's token
 * metadata only when the claim doesn't already match the resolved id, so a
 * steady-state login skips the Admin API write. Idempotent: the same call serves
 * first-time signup, returning login, and a row that needs recreating.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    @Inject(IDENTITY_PROVIDER) private readonly provider: IdentityProvider,
    @Inject(IDENTITY_METADATA_WRITER)
    private readonly metadataWriter: IdentityMetadataWriter,
    private readonly userIdentity: UserIdentityService,
  ) {}

  async provision(identity: NormalizedIdentity): Promise<void> {
    // Find-or-create the row; the resolved id is authoritative.
    const id = await this.userIdentity.resolve(this.provider.name, identity);

    // Token already carries the correct id → nothing to stamp.
    if (identity.claims.internal_id === id) return;

    const aiEnabled =
      identity.claims.ai_enabled ??
      this.configService.get<boolean>('ai.enabled_default', true);
    const plan =
      identity.claims.plan ??
      this.configService.get<PlanTier>('rate_limits.default_plan');

    await this.metadataWriter.stamp(identity.externalId, {
      internal_id: id,
      ai_enabled: aiEnabled,
      ...(plan !== undefined && { plan }),
      ...(identity.claims.movement_profile !== undefined && {
        movement_profile: identity.claims.movement_profile,
      }),
    });
  }
}
