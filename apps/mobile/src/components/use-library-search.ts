import { useCallback, useEffect, useRef, useState } from 'react';
import type { SavedPlaceView } from '@kebi-app/shared';
import { useApiClient } from '../api/hooks';
import { getLibrary } from '../api/library';
import { LIBRARY_PAGE_LIMIT, LIBRARY_SEARCH_DEBOUNCE_MS } from '../lib/library-config';

/**
 * Library search (ADR-164). `q` is a **server** param matched across the whole
 * library — the client no longer filters the rows it happens to hold, which is
 * what used to report a place three pages down as "no results".
 *
 * `filtered_total` is the count of matches across the whole library — the `3`
 * in "3 of 84". It cannot be derived here: under keyset paging the client
 * never sees the matches it wasn't sent.
 *
 * Keystrokes are debounced so typing a word is one request, not one per letter,
 * and every read is race-guarded by a monotonic request id — a slower response
 * for "can" must never overwrite the results for "canggu".
 */

export interface UseLibrarySearch {
  rows: SavedPlaceView[];
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  /** Matches across the whole library; `null` until the first response. */
  filteredTotal: number | null;
  loadMore: () => void;
  /** Re-run the current query after a failure. */
  retry: () => void;
}

export function useLibrarySearch(query: string): UseLibrarySearch {
  const client = useApiClient();
  const clientRef = useRef(client);
  clientRef.current = client;

  const [rows, setRows] = useState<SavedPlaceView[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [filteredTotal, setFilteredTotal] = useState<number | null>(null);

  const cursorRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const reqId = useRef(0);
  const queryRef = useRef(query);
  queryRef.current = query;

  const run = useCallback(async (mode: 'replace' | 'append') => {
    const q = queryRef.current;
    if (!q) return;
    const id = (reqId.current += 1);
    if (mode === 'replace') {
      setLoading(true);
      setError(false);
    } else {
      busyRef.current = true;
      setLoadingMore(true);
    }
    try {
      const res = await getLibrary(clientRef.current, {
        q,
        limit: LIBRARY_PAGE_LIMIT,
        cursor: mode === 'append' ? cursorRef.current ?? undefined : undefined,
      });
      if (id !== reqId.current) return; // superseded by a later keystroke
      cursorRef.current = res.next_cursor;
      setFilteredTotal(res.filtered_total);
      setRows((prev) => (mode === 'append' ? [...prev, ...res.places] : res.places));
    } catch {
      if (id !== reqId.current) return;
      if (mode === 'replace') setError(true);
    } finally {
      if (id === reqId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
      if (mode === 'append') busyRef.current = false;
    }
  }, []);

  // Debounce the query itself; clearing it resets rather than searching for "".
  useEffect(() => {
    if (!query) {
      reqId.current += 1; // drop any in-flight response for an older query
      cursorRef.current = null;
      setRows([]);
      setFilteredTotal(null);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      cursorRef.current = null;
      void run('replace');
    }, LIBRARY_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, run]);

  const loadMore = useCallback(() => {
    if (busyRef.current || !cursorRef.current) return;
    void run('append');
  }, [run]);

  const retry = useCallback(() => {
    cursorRef.current = null;
    void run('replace');
  }, [run]);

  return { rows, loading, loadingMore, error, filteredTotal, loadMore, retry };
}
