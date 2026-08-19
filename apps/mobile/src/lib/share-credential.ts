import type { HttpClient } from '../api/types';
import { mintShareToken, SHARE_TOKEN_RENEW_WITHIN_MS } from '../api/share-token';
import { clearShareFolded } from './share-fold';
import {
  canShareInBackground,
  clearAllShareState,
  storeApiBaseUrl,
  storeShareToken,
  storedShareTokenExpiry,
} from './share-storage';

/**
 * Keeps a share token minted and stored for the extension.
 *
 * **Currently unused on device.** The extension no longer sends anything — it
 * writes the link to the App Group and the app drains it with its own session,
 * so nothing reads this token today. It is kept because the moment `/extract`
 * can answer with `pending` in a second or two, the extension can post for
 * itself again and will need exactly this; deleting it would mean rebuilding
 * the gateway route, the middleware scope and this client to get back here.
 *
 * Called on every sign-in and restored session, alongside provisioning. Cheap
 * and idempotent by design: a token that is still comfortably valid costs one
 * synchronous read of the App Group and no request at all.
 *
 * Never throws. A share token the app failed to mint is not a user-visible
 * failure — the extension simply queues the link locally instead of sending it,
 * and the app drains that queue on next open. Degraded, still working.
 */
export async function ensureShareToken(client: HttpClient): Promise<void> {
  // No App Group (Android, simulator without the entitlement, Jest) — there is
  // nowhere to put a token and no extension to read it.
  if (!canShareInBackground()) return;

  // Refreshed every time, not just when the token is: the extension is compiled
  // once but a dev build and a production build point at different gateways,
  // and a stale base URL would post saves at whichever backend was last built.
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  if (baseUrl) storeApiBaseUrl(baseUrl);

  const expiry = storedShareTokenExpiry();
  if (expiry !== null && expiry - Date.now() > SHARE_TOKEN_RENEW_WITHIN_MS) return;

  try {
    const minted = await mintShareToken(client);
    // null = the gateway has no secret configured. Leave whatever is stored
    // alone: an old token that still works beats no token at all.
    if (minted) storeShareToken(minted.token, minted.expires_at);
  } catch {
    // Offline, 401 mid-refresh, gateway down. Try again on the next sign-in.
  }
}

/**
 * Hand the device back, on sign-out: revoke the extension's credential and wipe
 * the shares themselves.
 *
 * The token half is what stops a save — it is stateless and stays valid on the
 * server until it expires, so removing the only copy the extension can reach is
 * the real revocation. The rest is because none of this storage is scoped to an
 * account: whoever signs in next would otherwise read the last person's recent
 * activity, and their queued links would drain into the new account's library.
 *
 * Driven by the auth *status* rather than the sign-out button, so a session that
 * simply expires cleans up too. A link shared while nobody is signed in is
 * written after this runs and survives on purpose — that is the person holding
 * the phone, saving before they log in.
 */
export function clearShareState(): void {
  if (!canShareInBackground()) return;
  clearAllShareState();
  void clearShareFolded();
}
