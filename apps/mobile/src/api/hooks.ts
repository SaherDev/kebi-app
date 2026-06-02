import { createApiClient } from './client';

/**
 * Returns an API client for use in components.
 *
 * Token seam: until @clerk/clerk-expo is wired (separate follow-up task),
 * the token getter resolves an empty string. The only endpoint used so far
 * is the public GET /v1/health, which needs no auth, so this is correct and
 * live — not a stub.
 *
 * TODO(clerk-expo): replace the placeholder getter with
 * `const { getToken } = useAuth()` from '@clerk/clerk-expo' and return
 * `(await getToken()) ?? ''`.
 */
export function useApiClient() {
  return createApiClient(async () => '');
}
