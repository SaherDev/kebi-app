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

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** The verified provider identity (externalId, email, claims). Used by
       *  the provisioning endpoint; never forwarded to kebi. */
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
      const aiEnabledDefault = this.configService.get<boolean>('ai.enabled_default', true);
      req.user = { id: bypassUserId, ai_enabled: aiEnabledDefault } satisfies AuthUser;
      this.logger.warn(`Dev bypass auth used for user ${bypassUserId} — never enable in production`);
      return next();
    }

    try {
      const identity = await this.provider.verify(token);

      const aiEnabled =
        identity.claims.ai_enabled ??
        this.configService.get<boolean>('ai.enabled_default', true);

      // Verify and move on: attach the raw identity (for provisioning) and the
      // claim-first AuthUser. `id` is the stamped `internal_id` claim — present
      // once the user has signed in (POST /auth/login) and the token refreshed.
      // No DB read, no metadata write here.
      req.identity = identity;
      req.user = {
        id: identity.claims.internal_id ?? '',
        ai_enabled: aiEnabled,
        ...(identity.claims.plan !== undefined && { plan: identity.claims.plan }),
        ...(identity.claims.movement_profile !== undefined && {
          movement_profile: identity.claims.movement_profile,
        }),
      };

      next();
    } catch (error) {
      this.logger.error(
        `Token verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
