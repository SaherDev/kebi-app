import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthUser } from '@kebi-app/shared';
import { RateLimitService, PlanThresholds } from '../../rate-limit/rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthUser;

    // plan comes from the token (stamped from user_settings, ADR-045) — never
    // defaulted here. No plan / unknown plan → no thresholds → not rate-limited.
    const thresholds = user.plan
      ? this.configService.get<PlanThresholds>(`rate_limits.plans.${user.plan}`)
      : undefined;

    if (!thresholds) {
      return true;
    }

    const breach = this.rateLimitService.check(user.id, thresholds);
    if (breach) {
      throw new HttpException(
        {
          error: 'rate_limit_exceeded',
          limit: breach.limit,
          limit_value: breach.limit_value,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
