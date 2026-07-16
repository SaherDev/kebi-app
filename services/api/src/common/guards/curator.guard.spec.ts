import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { CuratorGuard } from './curator.guard';

function contextFor(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('CuratorGuard', () => {
  const guard = new CuratorGuard();

  it('allows a user whose token carries the curator role', () => {
    expect(guard.canActivate(contextFor({ id: 'user_1', ai_enabled: true, can_curate: true }))).toBe(
      true,
    );
  });

  it('denies a user without the role (can_curate: false)', () => {
    expect(() =>
      guard.canActivate(contextFor({ id: 'user_1', ai_enabled: true, can_curate: false })),
    ).toThrow(ForbiddenException);
  });

  it('fails closed when the claim is absent (pre-grant token)', () => {
    expect(() => guard.canActivate(contextFor({ id: 'user_1', ai_enabled: true }))).toThrow(
      ForbiddenException,
    );
  });

  it('throws when there is no authenticated user', () => {
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
  });
});
