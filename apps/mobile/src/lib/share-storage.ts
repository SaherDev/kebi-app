import {
  getSharedItem,
  isAppGroupAvailable,
  removeSharedItem,
  setSharedItem,
} from './app-group';
import { SHARE_HISTORY_MS } from './share-config';

/**
 * The App Group contract between the app and the "Save to Kebi" share extension
 * (share-and-forget). Two processes, two sandboxes — these key names are the
 * whole agreement, so they are duplicated in the extension's Swift and must
 * change together.
 *
 * The app owns writing the credential; the extension owns writing the queue. The
 * app only ever drains the queue, and the extension only ever reads the token.
 */
export const SHARE_KEYS = {
  /** Credential the extension saves with. Written on sign-in, cleared on sign-out. */
  token: 'kebi.share.token',
  /** Epoch ms the token lapses, so the app can re-mint before it does. */
  tokenExpiresAt: 'kebi.share.token_expires_at',
  /**
   * Gateway base URL the extension posts to. Written by the app rather than
   * baked into the extension at build time, so dev and production builds each
   * point at whatever the app itself is pointing at.
   */
  apiBaseUrl: 'kebi.share.api_base_url',
  /**
   * Links the extension wrote down, as a JSON array. The extension's only
   * output; the app drains it on open.
   */
  queue: 'kebi.share.queue',
  /**
   * Shares the app has taken off the queue and is working through, as a JSON
   * array. Written only by the app — it survives here rather than in component
   * state so a row keeps its place across a relaunch mid-drain.
   */
  pending: 'kebi.share.pending',
} as const;

/**
 * A share the app has adopted off the queue and is extracting. `outcome` is
 * filled in when the call returns; absent means still working, which is the
 * honest default.
 */
export interface PendingShare {
  id: string;
  raw_input: string;
  /**
   * What the host app called the thing being shared — TikTok passes the video
   * caption. Absent when the share carried no text. A url is not something a
   * person remembers, so this is what the card leads with when it exists.
   */
  title?: string;
  /** When the user shared it — epoch ms. What the card shows, not the drain time. */
  shared_at: number;
  /** Absent while still working. */
  outcome?: PendingOutcome;
  /**
   * When the user cleared this off home — epoch ms, absent until they do.
   *
   * ✕ used to delete the record, which made "show all" incapable of showing
   * anything the user had already waved away. Dismissal is now a mark: home
   * skips these, the screen keeps them, and {@link SHARE_HISTORY_MS} does the
   * forgetting.
   */
  dismissed_at?: number;
}

export interface PendingOutcome {
  status: 'completed' | 'failed';
  /**
   * Every place this share saved — one row each, nothing hidden behind "and N
   * more" on the one surface whose job is saying what landed. Empty on failure.
   */
  places: SharePlace[];
  /** kebi's failure_reason when it failed — drives which message the row shows. */
  failure_reason?: string;
}

/**
 * The slice of a saved place a share row needs: enough to draw it like any
 * other place row, and to open it. A name alone forces a generic pin and a
 * chevron that goes nowhere.
 */
export interface SharePlace {
  /** `PlaceCore.id` — what `/place` opens, same as a stash row pushes. */
  id: string | null;
  name: string;
  /** `PlaceCore.icon`, feeding PlaceAvatar. */
  icon: string | null;
  /** `PlaceCore.categories`, most-specific first — drives the emoji. */
  categories: string[];
}

/** One link the extension took but could not deliver. */
export interface QueuedShare {
  /** The raw shared text or URL, exactly as the extension received it. */
  raw_input: string;
  /** The host app's own label for it — see {@link PendingShare.title}. */
  title?: string;
  /** When the user shared it — epoch ms. The app shows this, not the drain time. */
  shared_at: number;
}

/** True when shared storage is usable at all (iOS with the App Group entitled). */
export function canShareInBackground(): boolean {
  return isAppGroupAvailable();
}

/**
 * Hand the extension a credential to save with. Returns whether it landed — a
 * false means the extension will have to queue instead, which is a degraded but
 * working path, not a failure to report.
 */
export function storeShareToken(token: string, expiresAt: number): boolean {
  return (
    setSharedItem(SHARE_KEYS.token, token) &&
    setSharedItem(SHARE_KEYS.tokenExpiresAt, String(expiresAt))
  );
}

/**
 * Point the extension at the same gateway the app uses. Written whenever the
 * token is, so a dev build and a production build never post to each other's
 * backend just because the extension was compiled once.
 */
export function storeApiBaseUrl(baseUrl: string): boolean {
  return setSharedItem(SHARE_KEYS.apiBaseUrl, baseUrl);
}

/** When the stored token lapses, or null if there is no usable token. */
export function storedShareTokenExpiry(): number | null {
  if (!getSharedItem(SHARE_KEYS.token)) return null;
  const raw = getSharedItem(SHARE_KEYS.tokenExpiresAt);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Revoke the extension's ability to save. Called on sign-out — the token stays
 * valid server-side until it expires, so removing the only copy the extension
 * can reach is what actually stops it.
 */
export function clearShareToken(): void {
  removeSharedItem(SHARE_KEYS.token);
  removeSharedItem(SHARE_KEYS.tokenExpiresAt);
}

/**
 * Read the links the extension could not send. Returns an empty array on absent
 * or unparseable content — a corrupt queue must not block the app from starting.
 */
export function readShareQueue(): QueuedShare[] {
  const raw = getSharedItem(SHARE_KEYS.queue);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isQueuedShare);
  } catch {
    return [];
  }
}

/**
 * Write the queue back after draining. The app rewrites the remainder rather
 * than clearing outright, because the extension may have appended a fresh share
 * while a drain was in flight — clearing would swallow it.
 */
export function writeShareQueue(items: QueuedShare[]): boolean {
  if (items.length === 0) return removeSharedItem(SHARE_KEYS.queue);
  return setSharedItem(SHARE_KEYS.queue, JSON.stringify(items));
}

/**
 * Shares handed to iOS, newest last. Anything without an `outcome` is still in
 * flight as far as the app can tell — which is the honest answer, since the
 * background session may not have been delivered yet.
 */
export function readPendingShares(): PendingShare[] {
  const raw = getSharedItem(SHARE_KEYS.pending);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPendingShare).filter(isFresh);
  } catch {
    return [];
  }
}

/**
 * Whether a record is still within the history window. Applied on read rather
 * than by a sweep: there is no background pass to hang one off, and reading is
 * the only moment the app is looking at this list anyway.
 *
 * A share still working is never aged out however old it is — an undelivered
 * outcome is unfinished business, not history.
 */
function isFresh(share: PendingShare): boolean {
  if (!share.outcome) return true;
  return Date.now() - share.shared_at < SHARE_HISTORY_MS;
}

/**
 * Take everything currently on home off it, keeping the records. What ✕ does.
 *
 * Shares still working are left alone: they have nothing to report yet, so
 * clearing them would mean the result of a link the user shared two minutes ago
 * never surfaces anywhere.
 */
export function dismissPendingShares(): boolean {
  const now = Date.now();
  return writePendingShares(
    readPendingShares().map((share) =>
      share.outcome && !share.dismissed_at ? { ...share, dismissed_at: now } : share,
    ),
  );
}

/** Write the pending list back — after recording an outcome, or after dismissal. */
export function writePendingShares(items: PendingShare[]): boolean {
  if (items.length === 0) return removeSharedItem(SHARE_KEYS.pending);
  return setSharedItem(SHARE_KEYS.pending, JSON.stringify(items));
}

/**
 * Throw the history away for good — the screen's "clear", the one place a
 * delete still happens. Shares still working survive it for the same reason
 * dismissal spares them: their result has nowhere else to land.
 */
export function clearShareHistory(): boolean {
  return writePendingShares(readPendingShares().filter((share) => !share.outcome));
}

/**
 * Record what became of one share. Re-reads before writing because the
 * extension may have appended a new share since the caller last looked, and a
 * blind overwrite would drop it. Unknown ids are ignored: a delivery for a share
 * the user already dismissed has nowhere to go, and that is fine.
 */
export function recordShareOutcome(id: string, outcome: PendingOutcome): boolean {
  const items = readPendingShares();
  let found = false;
  const next = items.map((item) => {
    if (item.id !== id) return item;
    found = true;
    return { ...item, outcome };
  });
  if (!found) return false;
  return writePendingShares(next);
}

function isPendingShare(value: unknown): value is PendingShare {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<PendingShare>;
  return (
    typeof item.id === 'string' &&
    item.id !== '' &&
    typeof item.raw_input === 'string' &&
    item.raw_input.trim() !== '' &&
    typeof item.shared_at === 'number'
  );
}

function isQueuedShare(value: unknown): value is QueuedShare {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<QueuedShare>;
  return (
    typeof item.raw_input === 'string' &&
    item.raw_input.trim() !== '' &&
    typeof item.shared_at === 'number'
  );
}
