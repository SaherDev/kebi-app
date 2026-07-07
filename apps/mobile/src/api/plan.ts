import type { PlanTier } from '@kebi-app/shared';
import type { HttpClient } from './types';
import { API_ROUTES } from './routes';
import { validate } from './validate';
import { UserProfile, UserProfileSchema } from './models/profile';

/**
 * Switch the caller's plan tier (gateway-local PATCH /user/plan). The gateway
 * writes the plan and re-stamps the token, then echoes the updated profile — the
 * client's source of truth until its token refreshes (see the plans screen,
 * which optimistically updates and then calls `refreshSession`). Identity is the
 * gateway's verified header, never a body field.
 */
export async function changePlan(client: HttpClient, plan: PlanTier): Promise<UserProfile> {
  const raw = await client.patch(API_ROUTES.userPlan, { plan });
  return validate(UserProfileSchema, raw, 'UserProfile');
}
