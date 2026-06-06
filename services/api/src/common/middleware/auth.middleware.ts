import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Logger,
  Inject,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthUser, NormalizedIdentity } from '@kebi-app/shared';
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

/**
 * Authentication middleware — verify and move on. It verifies the bearer token
 * via the configured IdentityProvider (provider-agnostic, no SDK knowledge here)
 * and attaches the verified identity to the request: `req.user` (claim-first —
 * `id` is the stamped `internal_id` claim, forwarded to kebi) and `req.identity`
 * (the raw provider identity, used by `POST /auth/login` to provision).
 *
 * It does NOT touch the DB or write token metadata — creating the internal user
 * and stamping `internal_id` is the explicit job of the provisioning endpoint
 * (AuthService), run once on sign-in. The provider's `externalId` never leaves
 * the gateway.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger('AuthMiddleware');

  constructor(
    private configService: ConfigService,
    @Inject(IDENTITY_PROVIDER) private readonly provider: IdentityProvider,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip auth for public routes (by path pattern). Middleware runs before
    // routing, so we match paths instead of decorators.
    const publicPaths = this.configService.get<string[]>('auth.public_paths', [
      '/health',
    ]);
    // originalUrl includes the global prefix (e.g. /api/v1/health) but
    // public_paths are prefix-relative (e.g. /health), so strip the configured
    // prefix before matching. Without this, no public path ever matches.
    const apiPrefix = this.configService.get<string>('app.api_prefix', '');
    const normalizedPrefix = apiPrefix
      ? `/${apiPrefix.replace(/^\/+|\/+$/g, '')}`
      : '';
    const fullPath = (req.originalUrl || req.url || '').split('?')[0];
    const requestUrl =
      normalizedPrefix && fullPath.startsWith(normalizedPrefix)
        ? fullPath.slice(normalizedPrefix.length) || '/'
        : fullPath;
    if (
      publicPaths.some(
        (path) => requestUrl === path || requestUrl.startsWith(path + '/'),
      )
    ) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn(`Unauthorized access attempt to ${req.method} ${req.path}`);
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Dev bypass: allow a static token for local testing (never enabled in production)
    const isProd =
      this.configService.get<string>('app.environment') === 'production';
    const bypassEnabled =
      this.configService.get<string>('APP_DEV_BYPASS_ENABLED') === 'true';
    const bypassToken = this.configService.get<string>('DEV_BYPASS_TOKEN');
    const bypassUserId = this.configService.get<string>('DEV_BYPASS_USER_ID');
    if (!isProd && bypassEnabled && bypassToken && token === bypassToken && bypassUserId) {
      req.user = new AuthenticatedUser({ id: bypassUserId, ai_enabled: true });
      this.logger.warn(`Dev bypass auth used for user ${bypassUserId} — never enable in production`);
      return next();
    }

    let identity;
    try {
      identity = await this.provider.verify(token);
    } catch (error) {
      this.logger.error(
        `Token verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new UnauthorizedException('Invalid or expired token');
    }

    req.identity = identity;
    const { internal_id, ai_enabled, plan, movement_profile } = identity.claims;

    // Provisioned tokens carry the stamped identity — internal_id + the product
    // claims sourced from user_settings (ADR-045). Attach them straight from the
    // token, no defaults. The values are the source of truth; the gateway never
    // fills them in.
    if (internal_id !== undefined) {
      if (ai_enabled === undefined) {
        throw new UnauthorizedException('Token is missing product claims');
      }
      req.user = new AuthenticatedUser({ id: internal_id, ai_enabled, plan, movement_profile });
      return next();
    }

    // Not provisioned yet (no internal_id). Only the provisioning endpoint may
    // proceed — it creates the user + stamps the token. Everything else fails:
    // we never run a request with a placeholder identity.
    const provisioningPaths = this.configService.get<string[]>(
      'auth.provisioning_paths',
      ['/auth/login'],
    );
    if (this.matchesPath(provisioningPaths, requestUrl)) {
      return next();
    }
    throw new UnauthorizedException('User not provisioned');
  }

  /** Prefix-relative path match (exact or as a path segment), shared by public
   *  and provisioning path checks. */
  private matchesPath(paths: string[], url: string): boolean {
    return paths.some((path) => url === path || url.startsWith(path + '/'));
  }
}
