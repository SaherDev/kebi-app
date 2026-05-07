import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthUser } from '@kebi-app/shared';

/**
 * @RequiresAi() guard validates that the user can access AI-powered endpoints.
 *
 * Checks:
 * 1. If AI_GLOBAL_KILL_SWITCH=true env var → throw ServiceUnavailableException (503)
 * 2. If user.ai_enabled is false → throw ForbiddenException (403)
 * 3. Otherwise → allow access (return true)
 *
 * Use with @RequiresAi() decorator on endpoints that call the AI service.
 *
 * @example
 * @Post('/consult')
 * @RequiresAi()
 * async consult(@Body() query: QueryDto) {
 *   return this.recommendationService.consult(query);
 * }
 */
@Injectable()
export class AiEnabledGuard implements CanActivate {
  private readonly logger = new Logger('AiEnabledGuard');

  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthUser | undefined;

    // Check global kill switch (Railway env var: AI_GLOBAL_KILL_SWITCH=true)
    const globalKillSwitch = this.configService.get<string>('AI_GLOBAL_KILL_SWITCH') === 'true';
    if (globalKillSwitch) {
      this.logger.warn('AI service is unavailable due to global kill switch');
      throw new ServiceUnavailableException('AI service is temporarily unavailable');
    }

    // Check user AI access
    if (!user) {
      this.logger.error('AiEnabledGuard called without authenticated user');
      throw new ForbiddenException('User context not found');
    }

    if (!user.ai_enabled) {
      this.logger.warn(`User ${user.id} attempted to access AI endpoint but AI is disabled for their account`);
      throw new ForbiddenException('AI features are not enabled for your account');
    }

    return true;
  }
}
