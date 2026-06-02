import { Injectable, NestMiddleware, UnauthorizedException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';
import { AuthUser, MovementProfile, PlanTier } from '@kebi-app/shared';

interface ClerkPublicMetadata {
  ai_enabled?: boolean;
  plan?: PlanTier;
  movement_profile?: MovementProfile;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

@Injectable()
export class ClerkMiddleware implements NestMiddleware {
  private readonly logger = new Logger('ClerkMiddleware');

  constructor(private configService: ConfigService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip auth for public routes (by path pattern)
    // Note: Middleware runs before routing, so we check paths instead of decorators
    const publicPaths = this.configService.get<string[]>('auth.public_paths', ['/health', '/webhooks/clerk']);
    // originalUrl includes the global prefix (e.g. /api/v1/health) but public_paths
    // are written relative to the API (e.g. /health), so strip the configured prefix
    // before matching. Without this, no public path ever matches.
    const apiPrefix = this.configService.get<string>('app.api_prefix', '');
    const normalizedPrefix = apiPrefix ? `/${apiPrefix.replace(/^\/+|\/+$/g, '')}` : '';
    const fullPath = (req.originalUrl || req.url || '').split('?')[0]; // Remove query string
    const requestUrl =
      normalizedPrefix && fullPath.startsWith(normalizedPrefix)
        ? fullPath.slice(normalizedPrefix.length) || '/'
        : fullPath;
    if (publicPaths.some(path => requestUrl === path || requestUrl.startsWith(path + '/'))) {
      return next();
    }

    // Extract Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn(`Unauthorized access attempt to ${req.method} ${req.path}`);
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Dev bypass: allow a static token for local testing (never enabled in production)
    const isProd = this.configService.get<string>('app.environment') === 'production';
    const bypassEnabled = this.configService.get<string>('APP_DEV_BYPASS_ENABLED') === 'true';
    const bypassToken = this.configService.get<string>('DEV_BYPASS_TOKEN');
    const bypassUserId = this.configService.get<string>('DEV_BYPASS_USER_ID');
    if (!isProd && bypassEnabled && bypassToken && token === bypassToken && bypassUserId) {
      const aiEnabledDefault = this.configService.get<boolean>('ai.enabled_default', true);
      req.user = { id: bypassUserId, ai_enabled: aiEnabledDefault } satisfies AuthUser;
      this.logger.warn(`Dev bypass auth used for user ${bypassUserId} — never enable in production`);
      return next();
    }

    try {
      // Verify token using Clerk backend SDK
      const clerkSecretKey = this.configService.get<string>('CLERK_SECRET_KEY');
      if (!clerkSecretKey) {
        throw new Error('CLERK_SECRET_KEY not configured');
      }

      const verifiedSession = await verifyToken(token, {
        secretKey: clerkSecretKey,
      });

      // Extract user info from verified token
      const userId = verifiedSession.sub;
      if (!userId) {
        throw new UnauthorizedException('Invalid token: missing user ID');
      }

      // Get ai_enabled from public_metadata, default to config value
      const aiEnabledDefault = this.configService.get<boolean>('ai.enabled_default', true);
      const publicMetadata = (verifiedSession.public_metadata ?? {}) as ClerkPublicMetadata;
      const ai_enabled = publicMetadata.ai_enabled ?? aiEnabledDefault;
      const plan = publicMetadata.plan;
      // Mobility setting carried as a token claim (like plan). Absent when the
      // user hasn't set one — the gateway forwards undefined and kebi applies a
      // neutral fallback. Never fabricated here.
      const movement_profile = publicMetadata.movement_profile;

      req.user = {
        id: userId,
        ai_enabled,
        ...(plan !== undefined && { plan }),
        ...(movement_profile !== undefined && { movement_profile }),
      };

      next();
    } catch (error) {
      this.logger.error(`Token verification failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
