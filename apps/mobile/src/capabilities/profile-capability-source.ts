import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/auth-context';
import { useApiClient } from '../api/hooks';
import { getProfile } from '../api/profile';
import { NO_CAPABILITIES, type CapabilitySet } from './capability';
import type { CapabilityState } from './capability-source';

/**
 * The capability source in use today: the caller's grants as the gateway reports
 * them on `GET /user/profile`, where `can_curate` rides beside `plan` (both are
 * account capabilities rather than editable preferences).
 *
 * Deliberately the *only* file that knows curation is spelled `can_curate` or
 * that it arrives over HTTP. See {@link CapabilitySource} for why that matters.
 *
 * Three behaviours worth stating, because they are what "one boolean stops
 * everything" actually requires:
 *
 * - **Signed out clears it.** Capabilities reset to nothing the moment auth
 *   drops, so a grant cannot survive into the next session on the device.
 * - **A failed read denies.** Offline or a 5xx resolves to
 *   {@link NO_CAPABILITIES}, never to the last good answer. Stale permission is
 *   the one failure mode this layer exists to prevent.
 * - **A late response cannot overwrite a newer state.** Responses are matched to
 *   the request that asked, so a slow in-flight read landing after a sign-out or
 *   a revalidate cannot resurrect a grant.
 */
export function useProfileCapabilitySource(): CapabilityState {
  const { status } = useAuth();
  const client = useApiClient();
  const clientRef = useRef(client);
  clientRef.current = client;

  const [capabilities, setCapabilities] = useState<CapabilitySet>(NO_CAPABILITIES);
  const [resolved, setResolved] = useState(false);
  const [nonce, setNonce] = useState(0);

  const revalidate = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    // Auth still settling: stay unresolved and permit nothing.
    if (status === 'loading') {
      setCapabilities(NO_CAPABILITIES);
      setResolved(false);
      return;
    }

    // Signed out is an authoritative answer — nothing is permitted, and we know
    // it without asking. Resolving here keeps gated UI from hanging on a fetch
    // that would 401 anyway.
    if (status === 'unauthenticated') {
      setCapabilities(NO_CAPABILITIES);
      setResolved(true);
      return;
    }

    let current = true;
    void (async () => {
      try {
        const profile = await getProfile(clientRef.current);
        if (!current) return;
        setCapabilities({ curate: profile.can_curate });
      } catch {
        // Fail closed. Not a fallback to the previous answer — a read we could
        // not complete is treated exactly like a denial.
        if (!current) return;
        setCapabilities(NO_CAPABILITIES);
      } finally {
        if (current) setResolved(true);
      }
    })();

    return () => {
      current = false;
    };
  }, [status, nonce]);

  return { capabilities, resolved, revalidate };
}
