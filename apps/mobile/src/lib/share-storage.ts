import {
  getSharedItem,
  isAppGroupAvailable,
  removeSharedItem,
  setSharedItem,
} from './app-group';

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
  /** Links the extension could not send, as a JSON array. Drained by the app. */
  queue: 'kebi.share.queue',
  /** Shares the extension handed to iOS, as a JSON array. See {@link PendingShare}. */
  pending: 'kebi.share.pending',
} as const;

/**
 * A share the extension handed to iOS to upload. The extension writes it before
 * posting and never touches it again — it is dead by the time an answer exists.
 * The app fills in `outcome` when the background session delivers the response,
 * which may be seconds later or on the next launch entirely.
 *
 * `id` is generated client-side because the extension cannot learn a server-side
 * request id: it dies before any response arrives. It is also what makes a
 * background-session retry safe to recognise.
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
}

export interface PendingOutcome {
  status: 'completed' | 'failed';
  /** Place names saved, for the card's rows. Empty on failure. */
  place_names: string[];
  /** kebi's failure_reason when it failed — drives which message the row shows. */
  failure_reason?: string;
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
    return parsed.filter(isPendingShare);
  } catch {
    return [];
  }
}

/** Write the pending list back — after recording an outcome, or after dismissal. */
export function writePendingShares(items: PendingShare[]): boolean {
  if (items.length === 0) return removeSharedItem(SHARE_KEYS.pending);
  return setSharedItem(SHARE_KEYS.pending, JSON.stringify(items));
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
