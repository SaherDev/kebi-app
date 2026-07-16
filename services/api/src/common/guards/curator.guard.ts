import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from '@kebi-app/shared';

/**
 * Gates curation on the admin-granted curator role (ADR-121/ADR-049), read
 * claim-first from the token's `can_curate` — no DB hit. Denies non-curators at
 * the edge (fail fast, no wasted kebi round-trip) as defense in depth beside
 * kebi's own header enforcement. Fails closed: an absent claim denies.
 */
@Injectable()
export class CuratorGuard implements CanActivate {
  private readonly logger = new Logger('CuratorGuard');

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthUser | undefined;

    if (!user) {
      this.logger.error('CuratorGuard called without authenticated user');
      throw new ForbiddenException('User context not found');
    }

    if (!user.can_curate) {
      this.logger.warn(`User ${user.id} attempted curation without the curator role`);
      throw new ForbiddenException('curation_not_permitted');
    }

    return true;
  }
}
