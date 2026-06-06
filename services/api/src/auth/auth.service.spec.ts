import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NormalizedIdentity } from '@kebi-app/shared';
import { AuthService } from './auth.service';
import { IdentityProvider } from './identity-provider.interface';
import { IdentityMetadataWriter } from './identity-metadata.writer';
import { UserIdentityService } from './user-identity.service';

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const config: Record<string, unknown> = {
        'ai.enabled_default': true,
        'rate_limits.default_plan': 'homebody',
        ...overrides,
      };
      return key in config ? config[key] : defaultValue;
    }),
  } as unknown as ConfigService;
}

describe('AuthService.provision', () => {
  let service: AuthService;
  let provider: IdentityProvider;
  let metadataWriter: { stamp: jest.Mock };
  let userIdentity: { resolve: jest.Mock };

  beforeEach(() => {
    provider = { name: 'supabase', verify: jest.fn() };
    metadataWriter = { stamp: jest.fn().mockResolvedValue(undefined) };
    userIdentity = { resolve: jest.fn().mockResolvedValue('user_internal_1') };
    service = new AuthService(
      makeConfig(),
      provider,
      metadataWriter as unknown as IdentityMetadataWriter,
      userIdentity as unknown as UserIdentityService,
    );
  });

  it('resolves (creating the user) and stamps when the token has no internal_id claim', async () => {
    const identity: NormalizedIdentity = { externalId: 'user_123', claims: {} };

    await service.provision(identity);

    expect(userIdentity.resolve).toHaveBeenCalledWith('supabase', identity);
    expect(metadataWriter.stamp).toHaveBeenCalledWith('user_123', {
      internal_id: 'user_internal_1',
      ai_enabled: true,
      plan: 'homebody', // rate_limits.default_plan
    });
  });

  it('still ensures the row exists but skips the stamp when the claim already matches', async () => {
    // resolve() finds the existing row → returns the same id the token carries.
    await service.provision({
      externalId: 'user_123',
      claims: { internal_id: 'user_internal_1' },
    });

    expect(userIdentity.resolve).toHaveBeenCalled(); // row existence is never assumed
    expect(metadataWriter.stamp).not.toHaveBeenCalled(); // already matches → no write
  });

  it('re-stamps when the claim is stale (row was recreated with a new id)', async () => {
    // Token claims an old id, but resolve() created a fresh row (e.g. after a DB reset).
    await service.provision({
      externalId: 'user_123',
      claims: { internal_id: 'user_OLD' },
    });

    expect(metadataWriter.stamp).toHaveBeenCalledWith(
      'user_123',
      expect.objectContaining({ internal_id: 'user_internal_1' }),
    );
  });
});
