import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { SavedPlaceView } from '@kebi-app/shared';
import { useApiClient } from '../api/hooks';
import { getLibrary } from '../api/library';
import { HOME_STASH_LIMIT } from '../lib/home-config';

/**
 * "your stash" data hook — the home preview of the most recent saves (a capped
 * GET /v1/user/library). Independent of the greeting and recall hooks (one
 * screen, three lifecycles). Refetches on focus so a place saved elsewhere
 * appears on return; race-guarded by a monotonic id. `total` drives the header
 * count (the whole stash, not just the preview); falls back to the loaded count
 * until kebi sends it. Empty → the section hides.
 */
export interface UseStash {
  views: SavedPlaceView[];
  total: number | null;
  loading: boolean;
  error: boolean;
  /** Re-read the stash. Home calls this when a place is saved from the global
   *  save sheet — that overlay doesn't change route focus either. */
  refetch: () => void;
}

export function useStash(): UseStash {
  const client = useApiClient();
  const clientRef = useRef(client);
  clientRef.current = client;

  const [views, setViews] = useState<SavedPlaceView[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = (reqId.current += 1);
    setLoading(true);
    setError(false);
    try {
      const res = await getLibrary(clientRef.current, { limit: HOME_STASH_LIMIT });
      if (id !== reqId.current) return;
      setViews(res.places);
      setTotal(res.total);
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

  return { views, total, loading, error, refetch: load };
}
