import { createApiClient } from "./client";
import { supabase } from "../lib/supabase";

/**
 * Returns an API client for use in components. The Bearer token is the current
 * Supabase access token; `getSession()` returns the cached session and triggers
 * a refresh when needed (auto-refresh is enabled on the client). Resolves to an
 * empty string when signed out — the gateway rejects unauthenticated calls to
 * protected routes, and the public GET /v1/health needs no token.
 */
export function useApiClient() {
  return createApiClient(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  });
}
