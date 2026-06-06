import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_MOVEMENT_PROFILE } from '@kebi-app/shared';
import type { MovementProfile, PlanTier, UserSettingsData } from '@kebi-app/shared';
import { UserSettingsRepository } from './user-settings.repository';

/**
 * Owns the user_settings row — our per-user product data and the source of truth
 * for the claims stamped into the token (ADR-045). `ensureForUser` find-or-creates
 * the row with config-seeded defaults (`user_settings.defaults.*`) on first sign-in.
 */
@Injectable()
export class UserSettingsService {
  private readonly logger = new Logger(UserSettingsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly settings: UserSettingsRepository,
  ) {}

  /**
   * Return the user's settings, creating them with default values on first sight.
   * Idempotent and race-safe — a concurrent create that loses the unique race
   * re-reads the winner's row.
   */
  async ensureForUser(userId: string): Promise<UserSettingsData> {
    const existing = await this.settings.findByUserId(userId);
    if (existing) return existing.settings;

    const defaults = this.defaults();
    try {
      const created = await this.settings.create(userId, defaults);
      return created.settings;
    } catch (error) {
      const row = await this.settings.findByUserId(userId);
      if (row) return row.settings;
      this.logger.error(
        `Failed to ensure settings for ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  /** Default settings for a new user, seeded from `user_settings.defaults` config. */
  private defaults(): UserSettingsData {
    return {
      plan: this.configService.get<PlanTier>('user_settings.defaults.plan', 'homebody'),
      ai_enabled: this.configService.get<boolean>('user_settings.defaults.ai_enabled', true),
      movement_profile: this.configService.get<MovementProfile>(
        'user_settings.defaults.movement_profile',
        DEFAULT_MOVEMENT_PROFILE,
      ),
    };
  }
}
