import { useEffect, useRef, useState } from 'react';
import { useApiClient } from '../api/hooks';
import { getArea } from '../api/area';
import type { AreaScreenView } from '../api/models/area';

/**
 * The area screen's data (api-contract.md §GET /v1/areas/{id}, kebi ADR-153).
 *
 * There is no seed path: an area is only ever reached by tapping a link, and no
 * list surface holds an area view to hand over, so every open fetches.
 *
 * **Thin first open.** An area nobody has opened before comes back
 * `profiled: false` — no summary, no level, no icon, its name and breadcrumb
 * straight off the geo registry's stored names (ADR-169) — and
 * that very response is what triggers kebi's profiler. The dressed row exists a
 * few seconds later, so this refetches **once**, after a delay, rather than
 * leaving the user on a bare header until they back out and return. One retry
 * is not polling: if the second response is still thin, the screen keeps what it
 * has and stops asking.
 */

/** How long to wait before the one retry that picks up the dressed profile. */
const PROFILE_RETRY_MS = 3000;

export type AreaViewState =
  | { status: 'loading'; view: null }
  | { status: 'ready'; view: AreaScreenView }
  | { status: 'failed'; view: null };

export function useAreaView(areaId: string | undefined): AreaViewState {
  const client = useApiClient();
  const clientRef = useRef(client);
  clientRef.current = client;

  const [view, setView] = useState<AreaScreenView | null>(null);
  const [failed, setFailed] = useState(false);
  // Whether anything has painted for *this* area. A ref, not the `view` state:
  // the effect would read a stale copy of state through its closure, and adding
  // `view` to the deps would restart the fetch on every load.
  const painted = useRef(false);

  useEffect(() => {
    if (!areaId) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    painted.current = false;

    const load = async (): Promise<AreaScreenView | null> => {
      try {
        const fresh = await getArea(clientRef.current, areaId);
        if (!live) return null;
        painted.current = true;
        setView(fresh);
        setFailed(false);
        return fresh;
      } catch {
        // A failed *retry* must not blank a screen that already painted — only
        // the first load can turn the screen into its failed state.
        if (live && !painted.current) setFailed(true);
        return null;
      }
    };

    void (async () => {
      const first = await load();
      // Only an undressed area is worth asking twice for.
      if (!live || !first || first.profiled) return;
      timer = setTimeout(() => void load(), PROFILE_RETRY_MS);
    })();

    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [areaId]);

  // A cold start onto a bare `/area` can never resolve, so it reads as failed
  // rather than spinning forever.
  if (view) return { status: 'ready', view };
  return failed || !areaId
    ? { status: 'failed', view: null }
    : { status: 'loading', view: null };
}
