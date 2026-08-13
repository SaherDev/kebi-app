import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_MOVEMENT_PROFILE } from '@kebi-app/shared';
import type {
  MovementMode,
  MovementProfile,
  PlanTier,
  Reach,
  UserAboutMe,
  UserSettingsData,
} from '@kebi-app/shared';
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

  /**
   * Switch the user's plan tier, preserving every other setting. Returns the new
   * settings document so the caller can re-stamp the token claims from it. The
   * row is created with defaults first if it somehow doesn't exist yet.
   */
  async updatePlan(userId: string, plan: PlanTier): Promise<UserSettingsData> {
    const current = await this.ensureForUser(userId);
    const next: UserSettingsData = { ...current, plan };
    await this.settings.update(userId, next);
    return next;
  }

  /**
   * Grant or revoke the admin-only curator role, preserving every other setting.
   * A plain product-data write — unlike `plan`, `can_curate` is not sealed into
   * the token, so no re-stamp is needed; the curate path reads it from settings.
   */
  async updateCanCurate(userId: string, canCurate: boolean): Promise<UserSettingsData> {
    const current = await this.ensureForUser(userId);
    const next: UserSettingsData = { ...current, can_curate: canCurate };
    await this.settings.update(userId, next);
    return next;
  }

  /**
   * Record the user's about-me (kebi ADR-154), preserving every other setting.
   * It rides the token like `plan`, so the caller re-stamps from the returned
   * document. A block with nothing in it is stored as `null` — an empty about-me
   * is the absence of one, not an empty one to forward.
   */
  async updateAboutMe(userId: string, aboutMe: UserAboutMe): Promise<UserSettingsData> {
    const current = await this.ensureForUser(userId);
    const empty =
      aboutMe.call_me === null && aboutMe.home_country === null && aboutMe.about === null;
    const next: UserSettingsData = { ...current, about_me: empty ? null : aboutMe };
    await this.settings.update(userId, next);
    return next;
  }

  /**
   * Record modes the user actually chose, preserving every other setting. The
   * write is what makes them `source: 'user'` — the only path that may claim it
   * (kebi ADR-155). kebi honours these modes verbatim; a seeded profile's are
   * ignored in favour of its own wider fallback, which is the intended
   * behaviour until a human picks.
   */
  async updateMovementProfile(
    userId: string,
    profile: { available_modes: MovementMode[]; reach?: Reach },
  ): Promise<UserSettingsData> {
    const current = await this.ensureForUser(userId);
    const next: UserSettingsData = {
      ...current,
      movement_profile: {
        available_modes: profile.available_modes,
        // Reach is an independent axis — a modes-only write keeps whatever the
        // user (or the seed) already had rather than resetting it.
        reach:
          profile.reach ?? current.movement_profile?.reach ?? this.defaultMovementProfile().reach,
        source: 'user',
      },
    };
    await this.settings.update(userId, next);
    return next;
  }

  /**
   * The config-seeded movement profile. Seeded, never chosen — kebi reads its
   * `source: 'default'` and substitutes its own wider fallback rather than
   * capping a user who may well drive (kebi ADR-155/156).
   */
  private defaultMovementProfile(): MovementProfile {
    return this.configService.get<MovementProfile>(
      'user_settings.defaults.movement_profile',
      DEFAULT_MOVEMENT_PROFILE,
    );
  }

  /** Default settings for a new user, seeded from `user_settings.defaults` config. */
  private defaults(): UserSettingsData {
    return {
      plan: this.configService.get<PlanTier>('user_settings.defaults.plan', 'homebody'),
      ai_enabled: this.configService.get<boolean>('user_settings.defaults.ai_enabled', true),
      can_curate: this.configService.get<boolean>('user_settings.defaults.can_curate', false),
      movement_profile: this.defaultMovementProfile(),
      // Nobody has told us anything about themselves yet. Config seeds a
      // capability we can guess at; it cannot seed a person.
      about_me: null,
    };
  }
}
