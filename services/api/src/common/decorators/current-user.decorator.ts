import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@kebi-app/shared';

/**
 * Decorator to inject the current authenticated user
 * Extracts req.user (populated by ClerkMiddleware) — id, ai_enabled, plan.
 *
 * Usage:
 * @Post()
 * async create(@CurrentUser() { id }: AuthUser, @Body() dto: CreateDto) {}
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthUser | undefined;
  }
);
