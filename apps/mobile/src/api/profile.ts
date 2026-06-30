import type { HttpClient } from './types';
import { API_ROUTES } from './routes';
import { validate } from './validate';
import { UserProfile, UserProfileSchema } from './models/profile';

/**
 * The caller's display profile (gateway-local GET/PATCH /user/profile). Thin
 * functions over the injected {@link HttpClient}; responses are validated at
 * this boundary into a class instance (ADR-046). Identity is the gateway's
 * verified header — never a body field.
 */

/** GET the caller's name / email / plan. */
export async function getProfile(client: HttpClient): Promise<UserProfile> {
  const raw = await client.get(API_ROUTES.userProfile);
  return validate(UserProfileSchema, raw, 'UserProfile');
}

/**
 * PATCH the display name. The response echoes the just-written name (the
 * client's source of truth until its token refreshes — see the settings screen).
 */
export async function updateProfile(client: HttpClient, name: string): Promise<UserProfile> {
  const raw = await client.patch(API_ROUTES.userProfile, { name });
  return validate(UserProfileSchema, raw, 'UserProfile');
}
