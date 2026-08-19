import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useApiClient } from '../api/hooks';
import { detectSource } from '../lib/detect-source';
import { formatRelativeTime } from '../lib/format-relative-time';
import { extractPlace } from '../api/extract';
import {
  canShareInBackground,
  clearShareHistory,
  dismissPendingShares,
  readPendingShares,
  readShareQueue,
  recordShareOutcome,
  writePendingShares,
  writeShareQueue,
  type PendingShare,
  type SharePlace,
} from '../lib/share-storage';

/**
 * What the "while you were away" surface renders — one row per link shared from
 * outside the app.
 *
 * `working` is the honest default. A share the extension handed to iOS has no
 * outcome until the background session is delivered, which may be seconds later
 * or on a later launch entirely; until then the only truthful thing to say is
 * that it is still going.
 */
export interface ShareResultRow {
  id: string;
  rawInput: string;
  /**
   * What to call this share before a place name exists. The host app's caption
   * when there is one; otherwise where and when it came from — TikTok supplies
   * no caption, and `vt.tiktok.com/ZSVSgEWX3` is not something anyone
   * recognises, whereas "tiktok · 10:28 pm" is the share you just made.
   */
  label: string;
  /**
   * The host app's own caption, when it sent one. The screen's group heading
   * prefers it over the link — a caption is what the share was *about*.
   */
  title?: string;
  /** Which app it came from — drives the row's glyph. */
  source: ReturnType<typeof detectSource>;
  sharedAt: number;
  state: 'working' | 'landed' | 'failed';
  /** Every place this share saved — one row each. Empty unless landed. */
  places: SharePlace[];
  failureReason?: string;
  /** Taken off home by ✕. Still history, so the screen keeps showing it. */
  dismissed: boolean;
}

export interface UseShareResults {
  rows: ShareResultRow[];
  /** Take the card off home. Keeps the records — the screen still has them. */
  dismiss: () => void;
  /** Delete the history outright. Only the screen offers this. */
  clear: () => void;
  /** Send a failed link again — the row's "try again". */
  retry: (id: string) => void;
}

export interface ShareResultsOptions {
  /**
   * Include shares the user has already cleared off home. The card wants the
   * live set; the screen behind "show all" is a history and wants everything.
   */
  includeDismissed?: boolean;
}

/**
 * Reads what came in while the app was away, and finishes the job for anything
 * the extension could not send itself.
 *
 * Two sources feed one list. Shares the extension handed to iOS already left
 * the phone — the app only reports them. Shares in the fallback queue (no token,
 * no network at share time) never left, so the app sends them now, all at once:
 * a handful of links is not worth serialising behind a 30–60 s path when the
 * user is watching.
 *
 * Runs on mount and on every foreground, one code path — whether the user was
 * gone five seconds or two days is not a distinction worth making.
 */
export function useShareResults({ includeDismissed = false }: ShareResultsOptions = {}): UseShareResults {
  const client = useApiClient();
  const clientRef = useRef(client);
  clientRef.current = client;

  const [rows, setRows] = useState<ShareResultRow[]>([]);
  const draining = useRef(false);

  const read = useCallback(() => {
    if (!canShareInBackground()) return;
    const all = readPendingShares().map(toRow);
    setRows(includeDismissed ? all : all.filter((row) => !row.dismissed));
  }, [includeDismissed]);

  const drain = useCallback(async () => {
    if (!canShareInBackground() || draining.current) return;
    const queued = readShareQueue();
    if (queued.length === 0) return;

    draining.current = true;
    try {
      // Move them into the pending list first, so they render as working rows
      // immediately and survive the app dying mid-drain — the queue is emptied
      // in the same breath so a relaunch cannot send them twice.
      const adopted: PendingShare[] = queued.map((item, index) => ({
        id: `local-${item.shared_at}-${index}`,
        raw_input: item.raw_input,
        title: item.title,
        shared_at: item.shared_at,
      }));
      writePendingShares([...readPendingShares(), ...adopted]);
      // Rewrite the remainder rather than clearing: the extension may have
      // appended while we were reading.
      const remaining = readShareQueue().filter(
        (item) => !queued.some((q) => q.raw_input === item.raw_input && q.shared_at === item.shared_at),
      );
      writeShareQueue(remaining);
      read();

      await Promise.all(
        adopted.map(async (item) => {
          try {
            const res = await extractPlace(clientRef.current, item.raw_input);
            recordShareOutcome(
              item.id,
              res.status === 'completed' && res.results.length > 0
                ? { status: 'completed', places: res.results.map(toSharePlace) }
                : {
                    status: 'failed',
                    places: [],
                    failure_reason: res.failure_reason ?? res.status,
                  },
            );
          } catch {
            // Transport failure or timeout. Left without an outcome on purpose:
            // "still working" beats telling the user it failed when the next
            // open may well resolve it.
          }
          read();
        }),
      );
    } finally {
      draining.current = false;
    }
  }, [read]);

  const refresh = useCallback(() => {
    read();
    void drain();
  }, [read, drain]);

  useEffect(() => {
    refresh();
    // Foreground, not focus: a share arrives while the app is backgrounded, and
    // route focus never changes.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const dismiss = useCallback(() => {
    dismissPendingShares();
    read();
  }, [read]);

  const clear = useCallback(() => {
    clearShareHistory();
    read();
  }, [read]);

  const retry = useCallback(
    (id: string) => {
      const target = readPendingShares().find((share) => share.id === id);
      if (!target) return;

      // Drop the outcome first so the row goes back to working immediately —
      // the send takes up to a minute, and a button that looks inert for that
      // long reads as broken. The dismissal goes with it: a retry is a live
      // share again, and belongs back on home where its result can be seen.
      writePendingShares(
        readPendingShares().map((share) =>
          share.id === id
          ? {
              id: share.id,
              raw_input: share.raw_input,
              title: share.title,
              shared_at: share.shared_at,
            }
          : share,
        ),
      );
      read();

      void (async () => {
        try {
          const res = await extractPlace(clientRef.current, target.raw_input);
          recordShareOutcome(
            id,
            res.status === 'completed' && res.results.length > 0
              ? { status: 'completed', places: res.results.map(toSharePlace) }
              : {
                  status: 'failed',
                  places: [],
                  failure_reason: res.failure_reason ?? res.status,
                },
          );
        } catch {
          // Same as the drain: no outcome beats a wrong one.
        }
        read();
      })();
    },
    [read],
  );

  return { rows, dismiss, clear, retry };
}

/**
 * Name a share the way a person would recall it. The caption if the host app
 * gave one; otherwise the source and the moment, because "the tiktok I shared
 * at 10:28" is a memory and a shortlink is not.
 */
/** Keep only what a row draws and opens — the response carries far more. */
function toSharePlace(result: {
  place: { id?: string | null; place_name: string; icon: string | null; categories: string[] };
}): SharePlace {
  return {
    id: result.place.id ?? null,
    name: result.place.place_name,
    icon: result.place.icon,
    categories: result.place.categories,
  };
}

function labelFor(share: PendingShare): string {
  if (share.title) return share.title;
  const source = detectSource(share.raw_input);
  const when = formatRelativeTime(new Date(share.shared_at).toISOString());
  return when ? `${source} · ${when}` : source;
}

function toRow(share: PendingShare): ShareResultRow {
  if (!share.outcome) {
    return {
      id: share.id,
      rawInput: share.raw_input,
      label: labelFor(share),
      title: share.title,
      source: detectSource(share.raw_input),
      sharedAt: share.shared_at,
      state: 'working',
      places: [],
      dismissed: false,
    };
  }
  const places = share.outcome.places ?? [];
  const landed = share.outcome.status === 'completed' && places.length > 0;
  return {
    id: share.id,
    rawInput: share.raw_input,
    label: labelFor(share),
    title: share.title,
    source: detectSource(share.raw_input),
    sharedAt: share.shared_at,
    state: landed ? 'landed' : 'failed',
    places,
    failureReason: share.outcome.failure_reason,
    dismissed: share.dismissed_at !== undefined,
  };
}
