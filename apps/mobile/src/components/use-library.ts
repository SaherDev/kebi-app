import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  STATUS_FILTERS,
  type LibraryStatusFilter,
  type SavedPlaceView,
  type UserPlace,
} from '@kebi-app/shared';
import { useApiClient } from '../api/hooks';
import { getLibrary, type LibraryQuery } from '../api/library';
import { LIBRARY_PAGE_LIMIT } from '../lib/library-config';

/**
 * Library data hook — owns the server-side read state for the Library screen.
 * Sort + status filter are server params (a change refetches from page 1; the
 * keyset `cursor` is sort-bound, so flipping sort must drop it — api-contract.md
 * §GET /v1/user/library). Search is the screen's concern (client-side over the
 * loaded list). Refetches on focus so a place saved from the sheet appears on
 * return.
 *
 * Reads are race-guarded by a monotonic request id: a stale page (an in-flight
 * request the user has already superseded by re-sorting/refiltering) is dropped.
 */

export type LibrarySort = 'recent' | 'name';

export interface UseLibrary {
  views: SavedPlaceView[];
  loading: boolean;
  /** True only during a user pull-to-refresh — drives the RefreshControl. */
  refreshing: boolean;
  loadingMore: boolean;
  error: boolean;
  hasMore: boolean;
  /** Grand total of the user's saves (unfiltered) — `null` until kebi sends it. */
  total: number | null;
  sort: LibrarySort;
  status: LibraryStatusFilter;
  setSort: (sort: LibrarySort) => void;
  setStatus: (status: LibraryStatusFilter) => void;
  refetch: () => void;
  /** Pull-to-refresh: reload page 1 showing the RefreshControl (not the spinner). */
  refresh: () => void;
  loadMore: () => void;
  /** Optimistic delete: drop a row (caller restores via refetch on failure). */
  removeLocally: (userPlaceId: string) => void;
  /** Optimistic PATCH: replace one row's user-state. */
  patchLocally: (userPlaceId: string, userData: UserPlace) => void;
}

function buildQuery(
  sort: LibrarySort,
  status: LibraryStatusFilter,
  cursor?: string,
): LibraryQuery {
  return { sort, ...STATUS_FILTERS[status], limit: LIBRARY_PAGE_LIMIT, cursor };
}

export function useLibrary(): UseLibrary {
  const client = useApiClient();
  // useApiClient() returns a fresh client each render; ref it so the load
  // callback stays stable (no refetch storm / focus-effect churn).
  const clientRef = useRef(client);
  clientRef.current = client;

  const [views, setViews] = useState<SavedPlaceView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [sort, setSortState] = useState<LibrarySort>('recent');
  const [status, setStatusState] = useState<LibraryStatusFilter>('all');

  // Current values read inside the stable `load` callback.
  const sortRef = useRef(sort);
  sortRef.current = sort;
  const statusRef = useRef(status);
  statusRef.current = status;
  const cursorRef = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);
  const reqId = useRef(0);

  const load = useCallback(async (mode: 'replace' | 'append', pull = false) => {
    const id = (reqId.current += 1);
    if (mode === 'replace') {
      // A pull-to-refresh shows the RefreshControl; every other reload (filter,
      // sort, focus, initial) uses `loading` so the list doesn't jump under a
      // dropped-in refresh spinner.
      if (pull) setRefreshing(true);
      else setLoading(true);
      setError(false);
    } else {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }
    try {
      const cursor = mode === 'append' ? cursorRef.current ?? undefined : undefined;
      const res = await getLibrary(
        clientRef.current,
        buildQuery(sortRef.current, statusRef.current, cursor),
      );
      if (id !== reqId.current) return; // superseded by a newer request
      cursorRef.current = res.next_cursor;
      setNextCursor(res.next_cursor);
      setTotal(res.total);
      setViews((prev) => (mode === 'append' ? [...prev, ...res.places] : res.places));
    } catch {
      if (id !== reqId.current) return;
      if (mode === 'replace') setError(true);
    } finally {
      if (id === reqId.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    }
  }, []);

  const refetch = useCallback(() => {
    cursorRef.current = null;
    void load('replace');
  }, [load]);

  const refresh = useCallback(() => {
    cursorRef.current = null;
    void load('replace', true);
  }, [load]);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !cursorRef.current) return;
    void load('append');
  }, [load]);

  const setSort = useCallback(
    (next: LibrarySort) => {
      setSortState(next);
      sortRef.current = next;
      refetch();
    },
    [refetch],
  );

  const setStatus = useCallback(
    (next: LibraryStatusFilter) => {
      setStatusState(next);
      statusRef.current = next;
      refetch();
    },
    [refetch],
  );

  const removeLocally = useCallback((userPlaceId: string) => {
    setViews((prev) => prev.filter((v) => v.user_data.user_place_id !== userPlaceId));
  }, []);

  const patchLocally = useCallback((userPlaceId: string, userData: UserPlace) => {
    setViews((prev) =>
      prev.map((v) =>
        v.user_data.user_place_id === userPlaceId ? { place: v.place, user_data: userData } : v,
      ),
    );
  }, []);

  // Refetch whenever the screen regains focus (e.g. after saving a place).
  useFocusEffect(
    useCallback(() => {
      void load('replace');
    }, [load]),
  );

  return {
    views,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore: nextCursor !== null,
    total,
    sort,
    status,
    setSort,
    setStatus,
    refetch,
    refresh,
    loadMore,
    removeLocally,
    patchLocally,
  };
}
