import { Inject, Injectable, Logger } from '@nestjs/common';
import type { UserSettingsData } from '@kebi-app/shared';
import {
  IDENTITY_METADATA_WRITER,
  type IdentityMetadataWriter,
  type StampClaims,
} from './identity-metadata.writer';
import { IDENTITY_PROVIDER } from './identity-provider.interface';
import type { IdentityProvider } from './identity-provider.interface';
import { UserIdentityService } from './user-identity.service';

/**
 * Projects a user_settings document onto the token claims and stamps it.
 *
 * user_settings is the source of truth (ADR-045) and the token is its cache, so
 * every writer of settings owes the same re-stamp — provisioning, the plan
 * switch, and each settings setter. Which fields ride the token, and how an
 * absent one is represented (omitted, never null), is decided here once instead
 * of at each call site.
 *
 * This is also the choke point for the identity-write invariant: reads may
 * trust the signed claims, but an identity **write** must match the `users`
 * mapping. Every stamp verifies the supplied internal id against the mapping
 * for `externalId` and refuses a mismatch — a caller holding an id from a
 * stale or corrupted token can never write it onto the account.
 */
@Injectable()
export class ClaimStamper {
  private readonly logger = new Logger(ClaimStamper.name);

  constructor(
    @Inject(IDENTITY_METADATA_WRITER)
    private readonly metadataWriter: IdentityMetadataWriter,
    @Inject(IDENTITY_PROVIDER) private readonly provider: IdentityProvider,
    private readonly userIdentity: UserIdentityService,
  ) {}

  async stamp(
    externalId: string,
    userId: string,
    settings: UserSettingsData,
  ): Promise<void> {
    const mapped = await this.userIdentity.lookup(this.provider.name, externalId);
    if (mapped === null) {
      // No mapping means no real account behind this identity (the local dev
      // bypass) — nothing to corrupt, and the Admin API write would 404. Skip.
      this.logger.warn(
        `No identity mapping for ${this.provider.name}:${externalId} — skipping claim stamp.`,
      );
      return;
    }
    if (mapped !== userId) {
      this.logger.error(
        `[IDENTITY_DRIFT] Refusing to stamp ${externalId}: caller supplied internal_id ${userId} but the mapping owns ${mapped}.`,
      );
      throw new Error(
        `Refusing to stamp claims for ${externalId}: supplied internal id does not match the identity mapping`,
      );
    }
    await this.metadataWriter.stamp(externalId, this.claimsOf(userId, settings));
  }

  /**
   * The claims a settings document implies. Nullable settings are omitted rather
   * than stamped as null — the claim vocabulary is "present or absent", and the
   * consumers (AuthenticatedUser, the chat forward) treat absent as unset.
   */
  claimsOf(userId: string, settings: UserSettingsData): StampClaims {
    return {
      internal_id: userId,
      ai_enabled: settings.ai_enabled,
      plan: settings.plan,
      can_curate: settings.can_curate,
      ...(settings.movement_profile !== null && {
        movement_profile: settings.movement_profile,
      }),
      ...(settings.about_me !== null && { about_me: settings.about_me }),
    };
  }
}
