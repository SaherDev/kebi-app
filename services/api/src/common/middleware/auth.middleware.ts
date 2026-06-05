import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Logger,
  Inject,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthUser, PlanTier } from '@kebi-app/shared';
import { IDENTITY_PROVIDER } from '../../auth/identity-provider.interface';
import type { IdentityProvider } from '../../auth/identity-provider.interface';
import { IDENTITY_METADATA_WRITER } from '../../auth/identity-metadata.writer';
import type { IdentityMetadataWriter } from '../../auth/identity-metadata.writer';
import { UserIdentityService } from '../../auth/user-identity.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Authentication middleware. Verifies the bearer token via the configured
 * IdentityProvider (provider-agnostic) and attaches the resolved AuthUser to the
 * request. Provider-specific verification lives entirely behind the injected
 * IdentityProvider — this middleware contains no SDK knowledge.
 *
 * Identity value: the stable internal id is resolved claim-first (read from the
 * signed `internal_id` token claim → no DB) with a one-time DB fallback for
 * users not yet stamped. That internal id is what gets forwarded to kebi as
 * `X-Gateway-User-Id` — the provider's `externalId` never leaves the gateway.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger('AuthMiddleware');

  constructor(
    private configService: ConfigService,
    @Inject(IDENTITY_PROVIDER) private readonly provider: IdentityProvider,
    @Inject(IDENTITY_METADATA_WRITER)
    private readonly metadataWriter: IdentityMetadataWriter,
    private readonly userIdentity: UserIdentityService,
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

      // Claim-first: the stamped `internal_id` claim avoids a DB hit. Fallback
      // (not-yet-stamped user / pre-refresh window): resolve once (creating the
      // mapping row), then stamp the provider's token metadata so the next
      // refreshed token carries the claim and later requests stay DB-free. The
      // stamp is a no-op for providers that stamp token metadata out-of-band.
      // This internal id is forwarded to kebi — externalId never leaves here.
      let id = identity.claims.internal_id;
      if (id === undefined) {
        id = await this.userIdentity.resolve(this.provider.name, identity);
        const plan =
          identity.claims.plan ??
          this.configService.get<PlanTier>('rate_limits.default_plan');
        await this.metadataWriter.stamp(identity.externalId, {
          internal_id: id,
          ai_enabled: aiEnabled,
          ...(plan !== undefined && { plan }),
          ...(identity.claims.movement_profile !== undefined && {
            movement_profile: identity.claims.movement_profile,
          }),
        });
      }

      req.user = {
        id,
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
