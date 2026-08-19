import type { HttpClient } from '../api/types';
import { mintShareToken, SHARE_TOKEN_RENEW_WITHIN_MS } from '../api/share-token';
import {
  canShareInBackground,
  clearShareToken,
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
 * Revoke the extension's ability to save, on sign-out. The token stays valid on
 * the server until it expires — it is stateless — so removing the only copy the
 * extension can reach is what actually stops it saving into an account nobody is
 * signed into any more.
 */
export function revokeShareToken(): void {
  if (!canShareInBackground()) return;
  clearShareToken();
}
