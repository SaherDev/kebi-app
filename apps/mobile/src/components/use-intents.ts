import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { IntentItem } from '@kebi-app/shared';
import { useApiClient } from '../api/hooks';
import { getIntents } from '../api/intents';
import { INTENTS_PREVIEW_LIMIT } from '../lib/home-config';

/**
 * "what you wanted" data hook — the home recall preview (api-contract.md §GET
 * /v1/user/intents). A cheap DB read, kept fully independent of the greeting
 * (use-home) and stash (use-stash): one screen, three lifecycles. Refetches on
 * focus so a turn taken in chat surfaces here on return. Reads are race-guarded
 * by a monotonic id so a stale response can't overwrite a newer one. Empty
 * history is not an error — the section simply hides.
 */
export interface UseIntents {
  intents: IntentItem[];
  loading: boolean;
  error: boolean;
  /** Re-read the recall list. Home calls this when a chat turn completes — the
   *  chat overlay doesn't change route focus, so the focus refetch won't fire. */
  refetch: () => void;
}

export function useIntents(): UseIntents {
  const client = useApiClient();
  const clientRef = useRef(client);
  clientRef.current = client;

  const [intents, setIntents] = useState<IntentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = (reqId.current += 1);
    setLoading(true);
    setError(false);
    try {
      const res = await getIntents(clientRef.current, { limit: INTENTS_PREVIEW_LIMIT });
      if (id !== reqId.current) return;
      setIntents(res.intents);
    } catch {
      if (id !== reqId.current) return;
      setError(true);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { intents, loading, error, refetch: load };
}
