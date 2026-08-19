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
  /** Links the extension could not send, as a JSON array. Drained by the app. */
  queue: 'kebi.share.queue',
} as const;

/** One link the extension took but could not deliver. */
export interface QueuedShare {
  /** The raw shared text or URL, exactly as the extension received it. */
  raw_input: string;
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

function isQueuedShare(value: unknown): value is QueuedShare {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<QueuedShare>;
  return (
    typeof item.raw_input === 'string' &&
    item.raw_input.trim() !== '' &&
    typeof item.shared_at === 'number'
  );
}
