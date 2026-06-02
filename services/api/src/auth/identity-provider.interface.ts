import { NormalizedIdentity } from '@kebi-app/shared';

/**
 * Interface for an authentication provider.
 * Abstracts token verification behind a provider-agnostic contract so the auth
 * provider (Clerk today) can be swapped via config without touching the request
 * path. Mirrors the IAiServiceClient / AI_SERVICE_CLIENT reference pattern.
 *
 * Implementations contain ALL provider-specific knowledge (SDK calls, claim
 * locations) and return a NormalizedIdentity. Business code depends on this
 * interface, never on a concrete SDK.
 */
export interface IdentityProvider {
  /** Provider key — matches `auth.provider` in config. */
  readonly name: string;

  /**
   * Verify a raw bearer token. Throws on an invalid or expired token.
   * Returns the normalized identity (external subject + product claims).
   */
  verify(token: string): Promise<NormalizedIdentity>;
}

/**
 * Injection token for IdentityProvider.
 * Used with @Inject(IDENTITY_PROVIDER) in the auth middleware.
 */
export const IDENTITY_PROVIDER = Symbol('IdentityProvider');
