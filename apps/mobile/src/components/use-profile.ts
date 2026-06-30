import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiClient } from '../api/hooks';
import { getProfile } from '../api/profile';
import { UserProfile } from '../api/models/profile';

/**
 * The caller's display profile for the settings screen (name / email / plan).
 * Fetched on **mount only** — deliberately not on focus: right after a name
 * edit the JWT is still stale (until `refreshSession` mints a new one), so a
 * focus refetch would flip the freshly-saved name back. The edit flow updates
 * the view optimistically via {@link setLocalName} instead; the next mount
 * reads the refreshed token.
 *
 * Fails soft on a transport error (offline/timeout): `profile` stays null and
 * `error` is set, so the screen can show a muted fallback rather than crash.
 */
export interface UseProfile {
  profile: UserProfile | null;
  loading: boolean;
  error: boolean;
  /** Re-fetch from the gateway (e.g. pull-to-refresh). */
  refetch: () => void;
  /** Optimistically patch the displayed name after a successful edit. */
  setLocalName: (name: string) => void;
}

export function useProfile(): UseProfile {
  const client = useApiClient();
  const clientRef = useRef(client);
  clientRef.current = client;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  const setLocalName = useCallback((name: string) => {
    setProfile((prev) =>
      prev ? new UserProfile({ name, email: prev.email, plan: prev.plan }) : prev,
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    (async () => {
      try {
        const res = await getProfile(clientRef.current);
        if (cancelled) return;
        setProfile(res);
      } catch {
        if (cancelled) return;
        setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { profile, loading, error, refetch, setLocalName };
}
