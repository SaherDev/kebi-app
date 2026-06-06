import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { NormalizedIdentity } from '@kebi-app/shared';

/**
 * Injects the verified provider identity (req.identity, populated by
 * AuthMiddleware) — externalId + claims. Used by the provisioning endpoint;
 * not forwarded to kebi.
 */
export const CurrentIdentity = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): NormalizedIdentity | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.identity as NormalizedIdentity | undefined;
  },
);
