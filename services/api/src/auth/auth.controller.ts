import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import type { NormalizedIdentity } from '@kebi-app/shared';
import { CurrentIdentity } from '../common/decorators/current-identity.decorator';
import { AuthService } from './auth.service';

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
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.NO_CONTENT)
  async login(@CurrentIdentity() identity: NormalizedIdentity | undefined): Promise<void> {
    if (!identity) {
      throw new UnauthorizedException('Missing authenticated identity');
    }
    await this.authService.provision(identity);
  }
}
