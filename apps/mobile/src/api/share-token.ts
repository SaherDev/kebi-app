import type { HttpClient } from './types';
import { API_ROUTES } from './routes';
import { validate } from './validate';
import { HttpError } from './transports/fetch.transport';
import { ShareToken, ShareTokenSchema } from './models/share-token';

/** The gateway's "share tokens are not configured" answer — a deployment state. */
const NOT_CONFIGURED = 503;

/**
 * How long before expiry the app re-mints the share token. Generous on purpose:
 * the cost of renewing early is one request the user never sees, and the cost of
 * renewing late is a share that lands on an expired credential days after the
 * user thought they saved it.
 */
export const SHARE_TOKEN_RENEW_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * `POST /auth/share-token` — mint the credential the iOS share extension saves
 * with while the app is dormant (share-and-forget).
 *
 * Returns `null` when the gateway has no share-token secret configured (503).
 * That is a deployment state, not an error the user should ever see: the caller
 * carries on without a share token, and the extension falls back to queueing the
 * link locally for the app to drain. Every other transport failure surfaces as
 * `HttpError` for the caller to decide about.
 */
export async function mintShareToken(client: HttpClient): Promise<ShareToken | null> {
  try {
    const raw = await client.post(API_ROUTES.shareToken, {});
    return validate(ShareTokenSchema, raw, 'ShareToken');
  } catch (error) {
    if (error instanceof HttpError && error.status === NOT_CONFIGURED) return null;
    throw error;
  }
}
