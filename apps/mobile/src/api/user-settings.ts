import type { MovementMode, Reach } from '@kebi-app/shared';
import type { HttpClient } from './types';
import { API_ROUTES } from './routes';
import { validate } from './validate';
import {
  MovementProfile,
  MovementProfileSchema,
  UserAboutMe,
  UserAboutMeSchema,
  UserSettings,
  UserSettingsSchema,
} from './models/user-settings';

/**
 * The caller's own settings — what kebi knows about them (about-me) and how
 * they get around. Thin functions over the injected {@link HttpClient};
 * responses are validated at this boundary into class instances (ADR-046).
 *
 * Both writes re-stamp the token claim server-side, so the caller should mint a
 * fresh session afterwards — otherwise the next chat turn goes out with the old
 * profile.
 */

/** GET both blocks in one call — feeds the settings rows and both edit screens. */
export async function getUserSettings(client: HttpClient): Promise<UserSettings> {
  const raw = await client.get(API_ROUTES.userSettings);
  return validate(UserSettingsSchema, raw, 'UserSettings');
}

/**
 * PATCH the about-me. **Whole-block**: every field is sent every time, because
 * an omitted field is cleared server-side, not preserved. Empty strings clear a
 * field (stored as null) rather than reaching kebi as prose.
 */
export async function updateAboutMe(
  client: HttpClient,
  aboutMe: { call_me: string; home_country: string | null; about: string },
): Promise<UserAboutMe> {
  const raw = await client.patch(API_ROUTES.userAboutMe, aboutMe);
  return validate(UserAboutMeSchema, raw, 'UserAboutMe');
}

/**
 * PATCH the movement profile. Reaching this endpoint is what earns the row
 * `source: "user"` — the gateway stamps it, never us — and only then does kebi
 * honour these modes instead of its own wide fallback.
 */
export async function updateMovementProfile(
  client: HttpClient,
  profile: { available_modes: MovementMode[]; reach: Reach },
): Promise<MovementProfile> {
  const raw = await client.patch(API_ROUTES.userMovement, profile);
  return validate(MovementProfileSchema, raw, 'MovementProfile');
}
