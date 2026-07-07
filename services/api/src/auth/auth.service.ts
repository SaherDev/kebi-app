import { Inject, Injectable, Logger } from '@nestjs/common';
import { NormalizedIdentity } from '@kebi-app/shared';
import { IDENTITY_PROVIDER } from './identity-provider.interface';
import type { IdentityProvider } from './identity-provider.interface';
import { IDENTITY_METADATA_WRITER } from './identity-metadata.writer';
import type { IdentityMetadataWriter } from './identity-metadata.writer';
import { PROFILE_WRITER } from './profile-writer.interface';
import type { ProfileWriter } from './profile-writer.interface';
import { UserIdentityService } from './user-identity.service';
import { UserSettingsService } from './user-settings.service';

/**
 * Provisions an authenticated identity into our system — the explicit work that
 * used to be a middleware side-effect. Called once on sign-in by
 * `POST /auth/login`.
 *
 * It always ensures both the internal User mapping and the user_settings row
 * exist (find-or-create) — never trusting the token's claims alone, since a row
 * could be missing while the token still carries claims (e.g. after a DB reset).
 * user_settings is the source of truth (ADR-045); the token is a cache. It
 * re-stamps the token only when its claims don't already match the settings (+
 * the resolved id), so a steady-state login skips the Admin API write.
 * Idempotent: the same call serves first-time signup, returning login, and a row
 * that needs recreating.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(IDENTITY_PROVIDER) private readonly provider: IdentityProvider,
    @Inject(IDENTITY_METADATA_WRITER)
    private readonly metadataWriter: IdentityMetadataWriter,
    @Inject(PROFILE_WRITER) private readonly profileWriter: ProfileWriter,
    private readonly userIdentity: UserIdentityService,
    private readonly userSettings: UserSettingsService,
  ) {}

  async provision(identity: NormalizedIdentity): Promise<void> {
    const userId = await this.userIdentity.resolve(this.provider.name, identity);
    const settings = await this.userSettings.ensureForUser(userId);

    await this.seedName(identity);

    // Stamp the token from settings only when it's out of sync (different id, or
    // plan/ai_enabled/movement_profile changed) — steady-state logins skip it.
    const claims = identity.claims;
    const inSync =
      claims.internal_id === userId &&
      claims.plan === settings.plan &&
      claims.ai_enabled === settings.ai_enabled &&
      JSON.stringify(claims.movement_profile ?? null) ===
        JSON.stringify(settings.movement_profile);
    if (inSync) return;

    await this.metadataWriter.stamp(identity.externalId, {
      internal_id: userId,
      ai_enabled: settings.ai_enabled,
      plan: settings.plan,
      ...(settings.movement_profile !== null && {
        movement_profile: settings.movement_profile,
      }),
    });
  }

  /**
   * Seed the display name once, on first sign-in only. Google OAuth populates
   * `user_metadata.full_name` (→ `identity.name` present) so the guard skips and
   * nothing is overwritten; an email-OTP signup has no name, so we derive one
   * from the email local-part; a phone-only signup has neither, so nothing is
   * seeded. Fails open — a seed failure must never break login (the name is
   * purely cosmetic and editable later).
   */
  private async seedName(identity: NormalizedIdentity): Promise<void> {
    if (identity.name || !identity.email) return;
    const seed = identity.email.split('@')[0]?.trim();
    if (!seed) return;
    try {
      await this.profileWriter.setName(identity.externalId, seed);
    } catch (error) {
      this.logger.warn(
        `Name seed failed for ${identity.externalId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
