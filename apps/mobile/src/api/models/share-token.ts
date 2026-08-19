import { z } from 'zod';
import type { ShareTokenResponse as ShareTokenResponseContract } from '@kebi-app/shared';

/**
 * Runtime model for `POST /auth/share-token` (share-and-forget). Same
 * class+schema pattern as ./profile: validate raw JSON at the boundary and
 * `.transform()` into a class instance (ADR-046).
 *
 * The token is opaque to the client — it is written into the App Group for the
 * share extension to send and is never decoded here (ADR-044: the client stays
 * blind to identity). `expires_at` is the one readable part, so the app can
 * re-mint before it lapses rather than finding out from a share that failed.
 */
export class ShareToken implements ShareTokenResponseContract {
  readonly token: string;
  readonly expires_at: number;

  constructor(p: ShareTokenResponseContract) {
    this.token = p.token;
    this.expires_at = p.expires_at;
  }

  /**
   * Whether the token should be replaced now. Re-minting is cheap and a lapsed
   * token costs a silently dropped share, so the app renews well before expiry
   * rather than at it.
   */
  needsRenewal(withinMs: number, now: number = Date.now()): boolean {
    return this.expires_at - now <= withinMs;
  }
}

export const ShareTokenSchema = z
  .object({
    token: z.string().min(1),
    expires_at: z.number(),
  })
  .transform((p) => new ShareToken(p));
