import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { SavedPlaceView, UserPlace } from '@kebi-app/shared';
import { useApiClient } from '../api/hooks';
import { getLibrary, getLibraryAreas } from '../api/library';
import { LIBRARY_PAGE_LIMIT } from '../lib/library-config';
import {
  buildLibraryGroups,
  elsewhereCount,
  groupKeyByAreaKey,
  orderLibraryGroups,
  type LibraryGroup,
} from '../lib/library-groups';
import { getDeviceCity, getDeviceCountryCode, getDeviceLocation } from '../lib/location';
import { useTranslation } from '../i18n/context';

/**
 * The Library at rest: saves grouped by area (ADR-165).
 *
 * **One paged read, grouped on the client.** Rows come from the ordinary
 * library call — 50 a page, so a normal library arrives in a single request and
 * every section is populated on first paint. Sections are derived from the rows
 * in hand, so a heading never appears above rows that haven't loaded yet.
 *
 * `GET /v1/user/library/areas` runs alongside it, and its job is **counts and
 * shape only**: it is complete and exact, so `Canggu 5` means five in the
 * library rather than five loaded so far, and the fold rule sees every area
 * even when the rows for some are still a page away.
 *
 * An earlier version fetched each section separately with `?area=`. It cost one
 * request per group — fifteen, for a real 37-save library — and made headings
 * land before their rows, which reads as broken. `?area=` is the right tool for
 * opening one area, not for assembling this screen.
 */

/** A section on the Library screen — a group plus its loaded rows. */
export interface LibrarySection {
  group: LibraryGroup;
  /** `false` for `elsewhere`, which has no area screen to open. */
  tappable: boolean;
  /** The area the device is standing in — why this section leads the list. */
  here: boolean;
  rows: SavedPlaceView[];
}

export interface UseLibrarySections {
  sections: LibrarySection[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: boolean;
  /** A paged read failed while the list already had rows (ADR-056). */
  moreError: boolean;
  /** Grand total of the caller's saves — the hero count. */
  total: number | null;
  loadMore: () => void;
  refetch: () => void;
  refresh: () => void;
  removeLocally: (userPlaceId: string) => void;
  patchLocally: (userPlaceId: string, userData: UserPlace) => void;
}

/** Sentinel key for the bucket of saves with no area. */
export const ELSEWHERE_KEY = ' elsewhere';

export function useLibrarySections(): UseLibrarySections {
  const { t } = useTranslation();
  const client = useApiClient();
  // useApiClient() returns a fresh client each render; ref it so the loaders
  // stay stable (no refetch storm / focus-effect churn).
  const clientRef = useRef(client);
  clientRef.current = client;

  const [rows, setRows] = useState<SavedPlaceView[]>([]);
  const [groups, setGroups] = useState<LibraryGroup[]>([]);
  const [orphans, setOrphans] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [total, setTotal] = useState<number | null>(null);

  const cursorRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const reqId = useRef(0);

  /**
   * Where the device is, so the areas you're standing in lead the list.
   * Resolved in the background: it must never gate the first paint, so the list
   * renders largest-first and re-orders when the fix arrives. A denied
   * permission or a failed geocode leaves it largest-first for good.
   */
  const [homeCountry, setHomeCountry] = useState<string | null>(null);
  /**
   * The locality the device is in, for the "you're here" badge only.
   *
   * Matched against a group's **name**, which grouping itself never does — a
   * name match is too fragile to file saves by. As a badge it is safe: the
   * worst a miss can do is not draw it.
   */
  const [hereName, setHereName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const coords = await getDeviceLocation();
      if (!coords || cancelled) return;
      const [code, city] = await Promise.all([
        getDeviceCountryCode(coords),
        getDeviceCity(coords),
      ]);
      if (cancelled) return;
      if (code) setHomeCountry(code);
      if (city) setHereName(city.toLowerCase());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Country names, from the translation bundle rather than `Intl.DisplayNames`
   * — Hermes doesn't implement it, so a runtime lookup silently degraded to the
   * bare code on device while every test passed under Node. Ref'd so `load`
   * stays stable.
   */
  const countryNamesRef = useRef<(code: string) => string | null>(() => null);
  countryNamesRef.current = (code: string) => {
    const key = `countries.${code.toLowerCase()}`;
    const name = t(key);
    // i18n-js echoes a missing key back; that is not a name.
    return name && name !== key && !name.startsWith('[missing') ? name : null;
  };

  const load = useCallback(async (pull = false) => {
    const id = (reqId.current += 1);
    if (pull) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      // Both at once — neither depends on the other, and the screen needs both
      // before it can draw a section with a truthful count.
      const [index, page] = await Promise.all([
        getLibraryAreas(clientRef.current),
        getLibrary(clientRef.current, { limit: LIBRARY_PAGE_LIMIT }),
      ]);
      if (id !== reqId.current) return;

      cursorRef.current = page.next_cursor;
      setGroups(buildLibraryGroups(index.areas, null, countryNamesRef.current));
      setOrphans(elsewhereCount(index.unassigned_count, index.areas, page.total));
      setTotal(page.total);
      setRows(page.places);
    } catch {
      if (id !== reqId.current) return;
      setError(true);
    } finally {
      if (id === reqId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const loadMore = useCallback(() => {
    if (busyRef.current || !cursorRef.current) return;
    busyRef.current = true;
    setLoadingMore(true);
    setMoreError(false);
    const id = reqId.current;
    void (async () => {
      try {
        const page = await getLibrary(clientRef.current, {
          limit: LIBRARY_PAGE_LIMIT,
          cursor: cursorRef.current ?? undefined,
        });
        if (id !== reqId.current) return;
        cursorRef.current = page.next_cursor;
        setRows((prev) => [...prev, ...page.places]);
      } catch {
        // The list keeps every row it already had — only its continuation
        // failed, and it says so at the tail rather than silently stopping,
        // which reads exactly like a list that ended (ADR-056).
        if (id === reqId.current) setMoreError(true);
      } finally {
        if (id === reqId.current) setLoadingMore(false);
        busyRef.current = false;
      }
    })();
  }, []);

  const refetch = useCallback(() => void load(), [load]);
  const refresh = useCallback(() => void load(true), [load]);

  const removeLocally = useCallback((userPlaceId: string) => {
    setRows((prev) => prev.filter((v) => v.user_data.user_place_id !== userPlaceId));
  }, []);

  const patchLocally = useCallback((userPlaceId: string, userData: UserPlace) => {
    setRows((prev) =>
      prev.map((v) =>
        v.user_data.user_place_id === userPlaceId ? { ...v, user_data: userData } : v,
      ),
    );
  }, []);

  /**
   * File the loaded rows under their headings.
   *
   * A section is only rendered when it has rows — the same principle as never
   * showing a filter that returns zero. A group whose rows are still a page
   * away simply isn't drawn yet, rather than appearing as an empty heading.
   */
  const sections = useMemo(() => {
    const lookup = groupKeyByAreaKey(groups);
    const byGroup = new Map<string, SavedPlaceView[]>();
    const elsewhere: SavedPlaceView[] = [];

    for (const row of rows) {
      const groupKey = row.area ? lookup.get(row.area.key) : undefined;
      if (!groupKey) {
        // No area, or an area the distribution didn't mention (saved since it
        // was read) — either way it belongs in the catch-all.
        elsewhere.push(row);
        continue;
      }
      const bucket = byGroup.get(groupKey);
      if (bucket) bucket.push(row);
      else byGroup.set(groupKey, [row]);
    }

    const named = orderLibraryGroups(
      groups.filter((group) => byGroup.has(group.key)),
      homeCountry,
    ).map((group) => ({
      group,
      tappable: true,
      here: hereName !== null && group.name.toLowerCase() === hereName,
      rows: byGroup.get(group.key) ?? [],
    }));

    if (elsewhere.length === 0) return named;
    return [
      ...named,
      {
        group: {
          key: ELSEWHERE_KEY,
          name: '',
          icon: null,
          uri: '',
          // kebi's `unassigned_count` is the honest total; the max guards the
          // rollout fallback, which understates until the library is paged in.
          count: Math.max(orphans, elsewhere.length),
          memberKeys: [],
          // These saves have no area, so no country either — never home.
          countryCode: null,
        },
        tappable: false,
        here: false,
        rows: elsewhere,
      },
    ];
  }, [rows, groups, orphans, homeCountry, hereName]);

  // Reload on focus so a place saved from the sheet appears on return — and so
  // its area's count is right, which a local insert could not know.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return {
    sections,
    loading,
    refreshing,
    loadingMore,
    error,
    moreError,
    total,
    loadMore,
    refetch,
    refresh,
    removeLocally,
    patchLocally,
  };
}
