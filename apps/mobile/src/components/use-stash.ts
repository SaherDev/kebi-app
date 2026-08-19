import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { SavedPlaceView } from '@kebi-app/shared';
import { useApiClient } from '../api/hooks';
import { getLibrary, getLibraryAreas } from '../api/library';
import { HOME_STASH_LIMIT } from '../lib/home-config';
import { buildLibraryGroups } from '../lib/library-groups';
import { getDeviceCountryCode, getDeviceLocation } from '../lib/location';
import { useTranslation } from '../i18n/context';

/**
 * "your stash" data hook — the home preview of **the Library's first group**.
 *
 * Home used to show the three newest saves, full stop, which on the road meant
 * offering three lakes in Kyrgyzstan to someone standing in Bali — on the one
 * screen that asks "where to next?". It now runs the *same* grouping the
 * Library does ({@link buildLibraryGroups}, same fold, same ordering) and
 * previews the group that comes first, fetched by its key. The two surfaces
 * cannot disagree, because they are the same function.
 *
 * Best-effort throughout: no location, no areas, or an empty group all fall
 * back to plain newest-first, which is never wrong — only less useful.
 * Independent of the greeting and recall hooks (one screen, three lifecycles).
 * Refetches on focus; race-guarded by a monotonic id. `total` is the whole
 * stash, not the preview. Empty → the section hides.
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
  const { t } = useTranslation();
  const client = useApiClient();
  const clientRef = useRef(client);
  clientRef.current = client;

  const [views, setViews] = useState<SavedPlaceView[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const reqId = useRef(0);

  const countryNamesRef = useRef<(code: string) => string | null>(() => null);
  countryNamesRef.current = (code: string) => {
    const key = `countries.${code.toLowerCase()}`;
    const name = t(key);
    return name && name !== key && !name.startsWith('[missing') ? name : null;
  };

  const load = useCallback(async () => {
    const id = (reqId.current += 1);
    setLoading(true);
    setError(false);
    try {
      // The unfiltered read is the fallback and the source of `total`, which is
      // the whole stash either way — so it is never wasted.
      const [plain, index, coords] = await Promise.all([
        getLibrary(clientRef.current, { limit: HOME_STASH_LIMIT }),
        getLibraryAreas(clientRef.current).catch(() => null),
        getDeviceLocation(),
      ]);
      if (id !== reqId.current) return;
      setTotal(plain.total);

      const country = coords ? await getDeviceCountryCode(coords) : null;
      if (id !== reqId.current) return;

      const first = index
        ? buildLibraryGroups(index.areas, country, countryNamesRef.current)[0]
        : undefined;

      if (first) {
        // Prefix-matched, so a folded group still returns everything beneath it.
        const scoped = await getLibrary(clientRef.current, {
          area: first.key,
          limit: HOME_STASH_LIMIT,
        });
        if (id !== reqId.current) return;
        if (scoped.places.length > 0) {
          setViews(scoped.places);
          return;
        }
      }

      setViews(plain.places);
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
