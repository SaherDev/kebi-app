/**
 * Writes the user's display name back to the active auth provider's user-owned
 * metadata (Supabase `user_metadata.name`). Name is PII owned by the provider,
 * not by our DB and not by kebi — so this is the one path that mutates it.
 *
 * The active implementation is selected by `auth.provider` (registry in
 * AuthModule), mirroring IdentityProvider / IdentityMetadataWriter (ADR-033).
 *
 * Fail semantics differ by caller, not by this contract:
 * - the one-time name *seed* during provisioning fails open (never break login);
 * - an explicit user-initiated PATCH lets failures propagate so the client can
 *   show "save failed" and roll back.
 * Implementations should therefore throw on a real write failure and let the
 * caller decide whether to swallow it.
 */
export interface ProfileWriter {
  setName(externalId: string, name: string): Promise<void>;
}

/** Injection token for ProfileWriter. */
export const PROFILE_WRITER = Symbol('ProfileWriter');
