import { useEffect, useRef, useState } from 'react';
import { useApiClient } from '../api/hooks';
import { ENTITY_SEARCH_MIN_LENGTH, searchEntities } from '../api/knowledge';
import type { EntityHit } from '../api/models/knowledge';

/** Keystroke settle time before a query goes out. */
const DEBOUNCE_MS = 250;

export interface EntitySearch {
  results: EntityHit[];
  loading: boolean;
  /** True once a query ran and came back with nothing — drives the empty line. */
  empty: boolean;
}

/**
 * Typeahead for the anchor chip. Debounced, and **ordered**: a slow response for
 * an older query can never overwrite a newer one, so backspacing fast doesn't
 * resurrect stale results. Below the contract's minimum term length nothing is
 * requested and the list is simply empty.
 *
 * A failed request resolves to no results rather than an error state: the anchor
 * is optional, so a search that cannot answer should leave the composer usable
 * rather than block on a retry.
 */
export function useEntitySearch(query: string): EntitySearch {
  const client = useApiClient();
  const clientRef = useRef(client);
  clientRef.current = client;

  const [results, setResults] = useState<EntityHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < ENTITY_SEARCH_MIN_LENGTH) {
      setResults([]);
      setLoading(false);
      setEmpty(false);
      return;
    }

    let current = true;
    setLoading(true);
    setEmpty(false);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const hits = await searchEntities(clientRef.current, term);
          if (!current) return;
          setResults(hits);
          setEmpty(hits.length === 0);
        } catch {
          if (!current) return;
          setResults([]);
          setEmpty(true);
        } finally {
          if (current) setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      // Marks this query's response stale *and* cancels a pending one, so both
      // the debounce and the in-flight request are ordered by the latest term.
      current = false;
      clearTimeout(timer);
    };
  }, [query]);

  return { results, loading, empty };
}
