import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';
import { MovementProfile, NormalizedIdentity, PlanTier } from '@kebi-app/shared';
import { IdentityProvider } from '../identity-provider.interface';

/**
 * Shape of the product claims the gateway/AuthUser care about. Supabase injects
 * these at the top level of the access token via a Custom Access Token Hook
 * (the Supabase analogue of Clerk's `public_metadata`).
 */
interface SupabaseClaims extends JWTPayload {
  ai_enabled?: boolean;
  plan?: PlanTier;
  movement_profile?: MovementProfile;
  internal_id?: string;
}

/**
 * Supabase implementation of IdentityProvider. Contains all Supabase-specific
 * knowledge: asymmetric (RS256/ES256) JWT verification against the project's
 * JWKS endpoint, the `sub` → externalId mapping, and the top-level custom-claim
 * locations written by the Custom Access Token Hook. Mirrors the Clerk provider
 * — business code depends only on the IdentityProvider interface.
 */
@Injectable()
export class SupabaseIdentityProvider implements IdentityProvider {
  readonly name = 'supabase';

  /**
   * Remote JWKS, built lazily from config on first verify. `createRemoteJWKSet`
   * caches keys in-memory and refetches on an unknown `kid` (with a cooldown),
   * so a single instance is the intended caching strategy — no manual cache.
   */
  private jwks?: JWTVerifyGetKey;

  constructor(private readonly configService: ConfigService) {}

  async verify(token: string): Promise<NormalizedIdentity> {
    const { jwks, issuer, audience } = this.resolveVerification();

    let payload: SupabaseClaims;
    try {
      ({ payload } = await jwtVerify<SupabaseClaims>(token, jwks, {
        issuer,
        audience,
      }));
    } catch (error) {
      throw new UnauthorizedException(
        `Token verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const externalId = payload.sub;
    if (!externalId) {
      throw new UnauthorizedException('Invalid token: missing subject');
    }

    const aiEnabledDefault = this.configService.get<boolean>(
      'ai.enabled_default',
      true,
    );

    return {
      externalId,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      claims: {
        ai_enabled: payload.ai_enabled ?? aiEnabledDefault,
        plan: payload.plan,
        movement_profile: payload.movement_profile,
        internal_id: payload.internal_id,
      },
    };
  }

  /**
   * Build (once) and return the JWKS plus the expected issuer/audience. The
   * JWKS URL derives from `SUPABASE_PROJECT_URL` unless `SUPABASE_JWKS_URL`
   * overrides it; issuer defaults to `${projectUrl}/auth/v1` and audience to
   * `authenticated`. Nothing is hardcoded.
   */
  private resolveVerification(): {
    jwks: JWTVerifyGetKey;
    issuer: string;
    audience: string;
  } {
    const projectUrl = this.configService
      .get<string>('SUPABASE_PROJECT_URL')
      ?.replace(/\/+$/, '');
    const jwksUrl =
      this.configService.get<string>('SUPABASE_JWKS_URL') ??
      (projectUrl ? `${projectUrl}/auth/v1/.well-known/jwks.json` : undefined);
    if (!jwksUrl) {
      throw new Error(
        'SUPABASE_PROJECT_URL (or SUPABASE_JWKS_URL) not configured',
      );
    }

    const issuer =
      this.configService.get<string>('auth.supabase.issuer') ??
      (projectUrl ? `${projectUrl}/auth/v1` : undefined);
    const audience = this.configService.get<string>(
      'auth.supabase.audience',
      'authenticated',
    );

    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(new URL(jwksUrl));
    }

    return { jwks: this.jwks, issuer: issuer as string, audience };
  }
}
