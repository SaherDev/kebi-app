import { MovementProfile, PlanTier } from '@kebi-app/shared';

/**
 * Product claims to persist into the auth provider's token-embedded metadata so
 * that future tokens carry them and the request path resolves identity + plan
 * without a DB hit (claim-first). `internal_id` is the stable gateway user id.
 */
export interface StampClaims {
  internal_id: string;
  plan?: PlanTier;
  movement_profile?: MovementProfile;
  ai_enabled?: boolean;
}

/**
 * Writes product claims back to the active auth provider's token metadata.
 *
 * The active implementation is selected by `auth.provider` (registry in
 * AuthModule), mirroring IdentityProvider. Providers that stamp out-of-band
 * (out-of-band, e.g. via a provider webhook) use the no-op writer, so the request path
 * stays provider-agnostic — it always calls `stamp()` after a fallback resolve
 * and lets the configured writer decide whether anything happens.
 *
 * Stamping is an optimization, never required for correctness: it fails open
 * (logs and returns) so a misconfiguration degrades to the DB-fallback path
 * rather than breaking auth.
 */
export interface IdentityMetadataWriter {
  /**
   * Persist `claims` into the provider's token metadata. Deduped per user by the
   * claims themselves: an identical repeat (the steady-state fallback path re-runs
   * every request until the token refreshes) is skipped, but any changed claim
   * (e.g. an explicit plan switch) re-stamps so the next token refresh carries it.
   */
  stamp(externalId: string, claims: StampClaims): Promise<void>;
}

/** Injection token for IdentityMetadataWriter. */
export const IDENTITY_METADATA_WRITER = Symbol('IdentityMetadataWriter');
