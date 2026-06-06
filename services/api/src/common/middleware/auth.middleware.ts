import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Logger,
  Inject,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthUser, IdentityClaims, NormalizedIdentity } from '@kebi-app/shared';
import { IDENTITY_PROVIDER } from '../../auth/identity-provider.interface';
import type { IdentityProvider } from '../../auth/identity-provider.interface';
import { AuthenticatedUser } from '../../auth/authenticated-user';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** The verified provider identity (externalId + claims). Used by the
       *  provisioning endpoint; never forwarded to kebi. */
      identity?: NormalizedIdentity;
    }
  }
}

const BEARER_PREFIX = 'Bearer ';

/**
 * Authentication middleware — verify and move on. It verifies the bearer token
 * via the configured IdentityProvider (provider-agnostic, no SDK knowledge here)
 * and attaches the verified identity to the request: `req.user` (the provisioned
 * principal, whose values are read straight from the stamped token claims) and
 * `req.identity` (the raw provider identity, used by `POST /auth/login`).
 *
 * It never touches the DB, writes token metadata, or fabricates defaults —
 * user_settings is the source of truth (ADR-045) and provisioning (AuthService)
 * is what stamps it into the token. A token that isn't provisioned yet may reach
 * only the provisioning route; anything else is rejected.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger('AuthMiddleware');

  constructor(
    private readonly configService: ConfigService,
    @Inject(IDENTITY_PROVIDER) private readonly provider: IdentityProvider,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const path = this.relativePath(req);
    if (this.matchesConfigured('auth.public_paths', ['/health'], path)) {
      return next();
    }

    const token = this.bearerToken(req);

    const bypassUser = this.devBypassUser(token);
    if (bypassUser) {
      req.user = bypassUser;
      return next();
    }

    const identity = await this.verifyToken(token);
    req.identity = identity;

    // A provisioned token carries internal_id → attach the principal from its
    // stamped claims. Not yet provisioned → only the provisioning route may pass
    // (it creates the user + stamps the token); everything else fails.
    if (identity.claims.internal_id !== undefined) {
      req.user = this.toAuthUser(identity.claims);
      return next();
    }
    if (this.matchesConfigured('auth.provisioning_paths', ['/auth/login'], path)) {
      return next();
    }
    throw new UnauthorizedException('User not provisioned');
  }

  /** Request path with the global api prefix stripped, so config paths can be
   *  written prefix-relative (e.g. `/health`, not `/api/v1/health`). */
  private relativePath(req: Request): string {
    const prefix = this.configService.get<string>('app.api_prefix', '');
    const normalized = prefix ? `/${prefix.replace(/^\/+|\/+$/g, '')}` : '';
    const full = (req.originalUrl || req.url || '').split('?')[0];
    return normalized && full.startsWith(normalized)
      ? full.slice(normalized.length) || '/'
      : full;
  }

  /** True when `path` matches any entry of the configured list (exact or as a
   *  leading path segment). */
  private matchesConfigured(key: string, fallback: string[], path: string): boolean {
    const paths = this.configService.get<string[]>(key, fallback);
    return paths.some((p) => path === p || path.startsWith(p + '/'));
  }

  /** Extract the bearer token, or reject. */
  private bearerToken(req: Request): string {
    const header = req.headers.authorization;
    if (!header || !header.startsWith(BEARER_PREFIX)) {
      this.logger.warn(`Unauthorized access attempt to ${req.method} ${req.path}`);
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }
    return header.slice(BEARER_PREFIX.length);
  }

  /** Local-only static-token bypass for testing — never active in production.
   *  Returns the synthetic principal, or null when the bypass doesn't apply. */
  private devBypassUser(token: string): AuthenticatedUser | null {
    const isProd = this.configService.get<string>('app.environment') === 'production';
    const enabled = this.configService.get<string>('APP_DEV_BYPASS_ENABLED') === 'true';
    const bypassToken = this.configService.get<string>('DEV_BYPASS_TOKEN');
    const bypassUserId = this.configService.get<string>('DEV_BYPASS_USER_ID');
    if (isProd || !enabled || !bypassToken || !bypassUserId || token !== bypassToken) {
      return null;
    }
    this.logger.warn(`Dev bypass auth used for user ${bypassUserId} — never enable in production`);
    return new AuthenticatedUser({ id: bypassUserId, ai_enabled: true });
  }

  /** Verify the token via the provider, mapping any failure to a 401. */
  private async verifyToken(token: string): Promise<NormalizedIdentity> {
    try {
      return await this.provider.verify(token);
    } catch (error) {
      this.logger.error(
        `Token verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /** Build the principal from a provisioned token's claims. The product claims
   *  are stamped together from user_settings, so a provisioned token missing
   *  them is corrupt — reject rather than default. */
  private toAuthUser(claims: IdentityClaims): AuthenticatedUser {
    if (claims.internal_id === undefined || claims.ai_enabled === undefined) {
      throw new UnauthorizedException('Token is missing required claims');
    }
    return new AuthenticatedUser({
      id: claims.internal_id,
      ai_enabled: claims.ai_enabled,
      plan: claims.plan,
      movement_profile: claims.movement_profile,
    });
  }
}
