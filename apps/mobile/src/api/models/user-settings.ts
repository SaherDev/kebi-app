import { z } from 'zod';
import { MOVEMENT_MODES, MOVEMENT_SOURCES, REACH_VALUES } from '@kebi-app/shared';
import type {
  MovementMode,
  MovementProfile as MovementProfileContract,
  MovementSource,
  Reach,
  UserAboutMe as UserAboutMeContract,
  UserSettingsResponse as UserSettingsResponseContract,
} from '@kebi-app/shared';

/**
 * Runtime models for the caller's own settings (gateway-local
 * GET /user/settings, PATCH /user/about-me, PATCH /user/movement). Same
 * class+schema pattern as ./profile: validate raw JSON at the boundary and
 * `.transform()` into class instances (ADR-046).
 *
 * Both blocks are nullable end to end — `null` means the user has never written
 * one, which is a real state the screens render differently from an empty one.
 */

export class UserAboutMe implements UserAboutMeContract {
  readonly call_me: string | null;
  readonly home_country: string | null;
  readonly about: string | null;

  constructor(p: UserAboutMeContract) {
    this.call_me = p.call_me;
    this.home_country = p.home_country;
    this.about = p.about;
  }

  /** Nothing said about themselves — the "not set" state on the settings row. */
  get isEmpty(): boolean {
    return this.call_me === null && this.home_country === null && this.about === null;
  }
}

export const UserAboutMeSchema = z
  .object({
    call_me: z.string().nullable(),
    home_country: z.string().nullable(),
    about: z.string().nullable(),
  })
  .transform((p) => new UserAboutMe(p));

export class MovementProfile implements MovementProfileContract {
  readonly available_modes: MovementMode[];
  readonly reach: Reach;
  readonly source?: MovementSource;

  constructor(p: MovementProfileContract) {
    this.available_modes = p.available_modes;
    this.reach = p.reach;
    if (p.source !== undefined) this.source = p.source;
  }

  /**
   * Whether a human ever chose these modes (kebi ADR-155). A seeded profile is
   * `default` — kebi ignores its modes and guesses wide — so the settings row
   * reads "not set" for it, however populated `available_modes` looks.
   */
  get isChosen(): boolean {
    return this.source === 'user';
  }
}

export const MovementProfileSchema = z
  .object({
    available_modes: z.array(z.enum(MOVEMENT_MODES)),
    reach: z.enum(REACH_VALUES),
    source: z.enum(MOVEMENT_SOURCES).optional(),
  })
  .transform((p) => new MovementProfile(p));

export class UserSettings implements UserSettingsResponseContract {
  readonly about_me: UserAboutMe | null;
  readonly movement_profile: MovementProfile | null;

  constructor(p: {
    about_me: UserAboutMe | null;
    movement_profile: MovementProfile | null;
  }) {
    this.about_me = p.about_me;
    this.movement_profile = p.movement_profile;
  }
}

export const UserSettingsSchema = z
  .object({
    about_me: UserAboutMeSchema.nullable(),
    movement_profile: MovementProfileSchema.nullable(),
  })
  .transform((p) => new UserSettings(p));
