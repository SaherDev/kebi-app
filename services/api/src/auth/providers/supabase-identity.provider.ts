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
import { AppMetadataCipher } from '../app-metadata.cipher';
import { TokenClaims } from '../token-claims';

/**
 * Product claims the gateway/AuthUser care about. Supabase carries these inside
 * the token's `app_metadata` (server-write-only, auto-embedded in every JWT).
 * We write them via the Admin API (see SupabaseMetadataWriter), sealed as a
 * single encrypted blob
 * under `app_metadata.<APP_METADATA_FIELD>` so they stay opaque to the token
 * holder; this provider decrypts that blob to recover them.
 */
interface SupabaseAppMetadata {
  ai_enabled?: boolean;
  plan?: PlanTier;
  movement_profile?: MovementProfile;
  internal_id?: string;
}

interface SupabaseTokenPayload extends JWTPayload {
  app_metadata?: Record<string, unknown>;
}

/**
 * Supabase implementation of IdentityProvider. Contains all Supabase-specific
 * knowledge: asymmetric (RS256/ES256) JWT verification against the project's
 * JWKS endpoint, the `sub` → externalId mapping, and the `app_metadata` claim
 * location. Business code depends only on the IdentityProvider interface.
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

  constructor(
    private readonly configService: ConfigService,
    private readonly cipher: AppMetadataCipher,
  ) {}

  async verify(token: string): Promise<NormalizedIdentity> {
    const { jwks, issuer, audience } = this.resolveVerification();

    let payload: SupabaseTokenPayload;
    try {
      ({ payload } = await jwtVerify<SupabaseTokenPayload>(token, jwks, {
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

    // Our product claims ride `app_metadata` as a single encrypted blob
    // (Admin-API-written, sourced from user_settings). Decrypt it and pass the
    // claims through as-is — no defaults. An absent/undecryptable blob yields no
    // claims (internal_id undefined), so the middleware treats the token as
    // not-yet-provisioned. user_settings is the source of truth (ADR-045).
    const blob = payload.app_metadata?.[this.cipher.field];
    const meta: SupabaseAppMetadata =
      (typeof blob === 'string' ? this.cipher.decrypt(blob) : null) ?? {};

    return {
      externalId,
      claims: new TokenClaims({
        ai_enabled: meta.ai_enabled,
        plan: meta.plan,
        movement_profile: meta.movement_profile,
        internal_id: meta.internal_id,
      }),
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
    const projectUrl = this.config('SUPABASE_PROJECT_URL')?.replace(/\/+$/, '');
    const jwksUrl =
      this.config('SUPABASE_JWKS_URL') ??
      (projectUrl ? `${projectUrl}/auth/v1/.well-known/jwks.json` : undefined);
    if (!jwksUrl) {
      throw new Error(
        'SUPABASE_PROJECT_URL (or SUPABASE_JWKS_URL) not configured',
      );
    }

    const issuer =
      this.config('auth.supabase.issuer') ??
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

  /**
   * Read a config string, treating empty/whitespace values as unset. `.env`
   * files load blank keys (e.g. `SUPABASE_JWKS_URL=`) as `''`, which would
   * defeat `??` fallbacks — coalesce them to `undefined` so derived defaults win.
   */
  private config(key: string): string | undefined {
    const value = this.configService.get<string>(key);
    return typeof value === 'string' && value.trim() !== '' ? value : undefined;
  }
}
