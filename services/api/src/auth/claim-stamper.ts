import { Inject, Injectable } from '@nestjs/common';
import type { UserSettingsData } from '@kebi-app/shared';
import {
  IDENTITY_METADATA_WRITER,
  type IdentityMetadataWriter,
  type StampClaims,
} from './identity-metadata.writer';

/**
 * Projects a user_settings document onto the token claims and stamps it.
 *
 * user_settings is the source of truth (ADR-045) and the token is its cache, so
 * every writer of settings owes the same re-stamp — provisioning, the plan
 * switch, and each settings setter. Which fields ride the token, and how an
 * absent one is represented (omitted, never null), is decided here once instead
 * of at each call site.
 */
@Injectable()
export class ClaimStamper {
  constructor(
    @Inject(IDENTITY_METADATA_WRITER)
    private readonly metadataWriter: IdentityMetadataWriter,
  ) {}

  async stamp(
    externalId: string,
    userId: string,
    settings: UserSettingsData,
  ): Promise<void> {
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
