import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { ClerkIdentityProvider } from './clerk-identity.provider';
import * as clerkBackend from '@clerk/backend';

jest.mock('@clerk/backend');

describe('ClerkIdentityProvider', () => {
  let provider: ClerkIdentityProvider;
  let mockVerifyToken: jest.Mock;

  beforeEach(async () => {
    mockVerifyToken = clerkBackend.verifyToken as jest.Mock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClerkIdentityProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              const config: Record<string, unknown> = {
                CLERK_SECRET_KEY: 'sk_test_mock_secret',
                'ai.enabled_default': true,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    provider = module.get(ClerkIdentityProvider);
  });

  afterEach(() => jest.clearAllMocks());

  it('exposes the provider name "clerk"', () => {
    expect(provider.name).toBe('clerk');
  });

  it('maps the Clerk sub to externalId and reads claims', async () => {
    mockVerifyToken.mockResolvedValue({
      sub: 'user_123',
      public_metadata: { ai_enabled: false, plan: 'explorer', internal_id: 'user_abc' },
    });

    const identity = await provider.verify('valid.token');

    expect(mockVerifyToken).toHaveBeenCalledWith('valid.token', {
      secretKey: 'sk_test_mock_secret',
    });
    expect(identity.externalId).toBe('user_123');
    expect(identity.claims.ai_enabled).toBe(false);
    expect(identity.claims.plan).toBe('explorer');
    expect(identity.claims.internal_id).toBe('user_abc');
  });

  it('defaults ai_enabled from config when absent', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'user_456', public_metadata: {} });

    const identity = await provider.verify('valid.token');

    expect(identity.claims.ai_enabled).toBe(true);
    expect(identity.claims.internal_id).toBeUndefined();
  });

  it('throws when the token has no subject', async () => {
    mockVerifyToken.mockResolvedValue({ sub: null, public_metadata: {} });

    await expect(provider.verify('some.token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws when CLERK_SECRET_KEY is not configured', async () => {
    const bad = new ClerkIdentityProvider({
      get: jest.fn(() => undefined),
    } as unknown as ConfigService);

    await expect(bad.verify('some.token')).rejects.toThrow(
      'CLERK_SECRET_KEY not configured',
    );
  });
});
