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
 * If the token already carries `internal_id` (returning user, already stamped),
 * provisioning is a no-op. Otherwise it resolves the identity — creating the
 * internal User row on first sight — and stamps `internal_id` (+ plan/ai_enabled
 * /movement_profile) into the provider's token metadata, so the next refreshed
 * token is claim-first and the middleware stays a pure verify. Idempotent: the
 * same call serves first-time signup and returning login.
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
    if (identity.claims.internal_id !== undefined) return;

    const id = await this.userIdentity.resolve(this.provider.name, identity);
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
