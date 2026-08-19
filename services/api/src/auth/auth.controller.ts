import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AuthUser,
  NormalizedIdentity,
  ShareTokenResponse,
} from '@kebi-app/shared';
import { CurrentIdentity } from '../common/decorators/current-identity.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { ShareTokenService } from './share-token.service';

/**
 * Provisions the authenticated user into our system. After Supabase
 * authenticates the client, the app calls `POST /auth/login` once per session;
 * this creates the internal User row on first sign-in and stamps `internal_id`
 * into the token (via AuthService). Returns 204 — the client needs to know
 * nothing about the user, only that provisioning happened. The same call covers
 * first-time signup and returning login (idempotent).
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly shareTokens: ShareTokenService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.NO_CONTENT)
  async login(@CurrentIdentity() identity: NormalizedIdentity | undefined): Promise<void> {
    if (!identity) {
      throw new UnauthorizedException('Missing authenticated identity');
    }
    await this.authService.provision(identity);
  }

  /**
   * Mint the credential the iOS share extension saves with while the app is
   * dormant (share-and-forget). Reachable only with a live session — a share
   * token is scoped away from this route, so one can never mint another.
   *
   * 503 when the secret is unconfigured: the client treats that as "no share
   * token available" and falls back to queueing the link locally, rather than
   * shipping an extension that silently posts unauthenticated.
   */
  @Post('share-token')
  shareToken(@CurrentUser() user: AuthUser | undefined): ShareTokenResponse {
    if (!user) {
      throw new UnauthorizedException('Missing authenticated user');
    }
    if (!this.shareTokens.isConfigured()) {
      throw new ServiceUnavailableException('Share tokens are not configured');
    }
    const { token, expiresAt } = this.shareTokens.mint(user.id);
    return { token, expires_at: expiresAt };
  }
}
