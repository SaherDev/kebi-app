import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Token format invariants — NOT config on purpose, for the same reason as
 * AppMetadataCipher's cipher constants: exposing them as runtime knobs would
 * invite an accidental downgrade. The prefix is what lets a credential verifier
 * recognise a share token without parsing it.
 */
const PREFIX = 'kst_';
const ALGORITHM = 'sha256';
const SEPARATOR = '.';
/** Minimum secret length. HMAC-SHA256 gains nothing above its block size, but a
 *  short secret is brute-forcible — refuse rather than pretend to be signed. */
const MIN_SECRET_BYTES = 32;
const DEFAULT_TTL_DAYS = 90;
const MS_PER_DAY = 86_400_000;

/** What a valid share token asserts: which user, and until when. */
interface SharePayload {
  /** Internal user id (never the provider's external id). */
  sub: string;
  /** Expiry, epoch milliseconds. */
  exp: number;
  /** Random, so two tokens minted for the same user in the same millisecond differ. */
  jti: string;
}

/**
 * The credential the iOS share extension uses to save a place while the app is
 * dormant (share-and-forget, docs/plans/2026-08-19-share-and-forget.md).
 *
 * **Why not the Supabase session.** The access token lives ~1 h, so the extension
 * would have to refresh — and Supabase *rotates* refresh tokens, so a refresh
 * from the extension invalidates the app's stored one and silently signs the user
 * out. A second, narrow credential avoids touching the session at all.
 *
 * **What it asserts is deliberately thin:** a user id and an expiry, nothing else.
 * Product claims (plan, ai_enabled, entitlements) are resolved from
 * user_settings at verification time — that is the source of truth (ADR-045), and
 * a 90-day token carrying a stamped `plan` would hand a downgraded user their old
 * entitlements for three months.
 *
 * **Blast radius.** A stolen share token lets an attacker save places into the
 * victim's library. That is real but bounded, and unlike a session token it
 * cannot read anything. Revocation is by expiry; sign-out clears the copy in the
 * App Group.
 *
 * Fails closed: an unconfigured secret disables minting *and* verification, so a
 * misconfigured deploy rejects share tokens rather than accepting unsigned ones.
 */
@Injectable()
export class ShareTokenService {
  private readonly logger = new Logger(ShareTokenService.name);
  private readonly secret: Buffer | null;
  private readonly ttlMs: number;

  constructor(configService: ConfigService) {
    const raw = configService.get<string>('SHARE_TOKEN_SECRET')?.trim();
    let secret: Buffer | null = null;
    if (raw) {
      const buf = Buffer.from(raw, 'utf8');
      if (buf.length >= MIN_SECRET_BYTES) secret = buf;
      else
        this.logger.error(
          `SHARE_TOKEN_SECRET must be at least ${MIN_SECRET_BYTES} bytes — share tokens disabled.`,
        );
    }
    this.secret = secret;

    const ttlDays = configService.get<number>(
      'auth.share_token.ttl_days',
      DEFAULT_TTL_DAYS,
    );
    this.ttlMs = ttlDays * MS_PER_DAY;
  }

  /** True when a valid secret is configured and mint/verify will operate. */
  isConfigured(): boolean {
    return this.secret !== null;
  }

  /**
   * True when `token` claims to be a share token. A cheap prefix test so a
   * credential verifier can decide whether to handle it — says nothing about
   * validity, which only {@link verify} decides.
   */
  isShareToken(token: string): boolean {
    return token.startsWith(PREFIX);
  }

  /**
   * Mint a token for an internal user id. The expiry is returned alongside so the
   * app can re-mint before it lapses rather than discovering it from a 401 on a
   * share it can no longer retry. Throws only if misused without a secret.
   */
  mint(userId: string): { token: string; expiresAt: number } {
    if (!this.secret) {
      throw new Error('ShareTokenService.mint called without a configured secret');
    }
    const payload: SharePayload = {
      sub: userId,
      exp: Date.now() + this.ttlMs,
      jti: randomBytes(8).toString('base64url'),
    };
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return {
      token: `${PREFIX}${body}${SEPARATOR}${this.sign(body)}`,
      expiresAt: payload.exp,
    };
  }

  /**
   * Verify a token and return the internal user id it asserts, or null if it is
   * malformed, unsigned, tampered with, or expired. Never throws — every failure
   * is the same answer to the caller: this is not a valid credential.
   */
  verify(token: string): string | null {
    if (!this.secret || !this.isShareToken(token)) return null;

    const [body, signature, ...rest] = token.slice(PREFIX.length).split(SEPARATOR);
    if (!body || !signature || rest.length > 0) return null;
    if (!this.signatureMatches(body, signature)) return null;

    const payload = this.decode(body);
    if (!payload) return null;
    if (payload.exp <= Date.now()) {
      this.logger.debug('Share token rejected: expired');
      return null;
    }
    return payload.sub;
  }

  private sign(body: string): string {
    // Non-null asserted by every caller checking `this.secret` first.
    return createHmac(ALGORITHM, this.secret as Buffer)
      .update(body)
      .digest('base64url');
  }

  /** Constant-time signature comparison — a length mismatch is itself a mismatch. */
  private signatureMatches(body: string, signature: string): boolean {
    const expected = Buffer.from(this.sign(body), 'utf8');
    const actual = Buffer.from(signature, 'utf8');
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  }

  /** Parse a signature-verified body. Returns null on anything unexpected. */
  private decode(body: string): SharePayload | null {
    try {
      const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (
        typeof parsed?.sub !== 'string' ||
        parsed.sub === '' ||
        typeof parsed?.exp !== 'number'
      ) {
        return null;
      }
      return parsed as SharePayload;
    } catch {
      return null;
    }
  }
}
