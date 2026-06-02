import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { SupabaseIdentityProvider } from './supabase-identity.provider';
import * as jose from 'jose';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => jest.fn()),
  jwtVerify: jest.fn(),
}));

describe('SupabaseIdentityProvider', () => {
  let provider: SupabaseIdentityProvider;
  let mockJwtVerify: jest.Mock;
  let mockCreateRemoteJWKSet: jest.Mock;

  const config: Record<string, unknown> = {
    SUPABASE_PROJECT_URL: 'https://ref.supabase.co',
    'ai.enabled_default': true,
  };

  beforeEach(async () => {
    mockJwtVerify = jose.jwtVerify as unknown as jest.Mock;
    mockCreateRemoteJWKSet = jose.createRemoteJWKSet as unknown as jest.Mock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseIdentityProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (key: string, defaultValue?: unknown) =>
                config[key] ?? defaultValue,
            ),
          },
        },
      ],
    }).compile();

    provider = module.get(SupabaseIdentityProvider);
  });

  afterEach(() => jest.clearAllMocks());

  it('exposes the provider name "supabase"', () => {
    expect(provider.name).toBe('supabase');
  });

  it('maps the Supabase sub to externalId and reads top-level claims', async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: 'uuid-123',
        email: 'user@example.com',
        ai_enabled: false,
        plan: 'explorer',
        internal_id: 'user_abc',
      },
    });

    const identity = await provider.verify('valid.token');

    expect(identity.externalId).toBe('uuid-123');
    expect(identity.email).toBe('user@example.com');
    expect(identity.claims.ai_enabled).toBe(false);
    expect(identity.claims.plan).toBe('explorer');
    expect(identity.claims.internal_id).toBe('user_abc');
  });

  it('verifies against the derived JWKS URL with issuer and audience', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'uuid-1' } });

    await provider.verify('valid.token');

    expect(mockCreateRemoteJWKSet).toHaveBeenCalledWith(
      new URL('https://ref.supabase.co/auth/v1/.well-known/jwks.json'),
    );
    expect(mockJwtVerify).toHaveBeenCalledWith('valid.token', expect.anything(), {
      issuer: 'https://ref.supabase.co/auth/v1',
      audience: 'authenticated',
    });
  });

  it('defaults ai_enabled from config when absent', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'uuid-456' } });

    const identity = await provider.verify('valid.token');

    expect(identity.claims.ai_enabled).toBe(true);
    expect(identity.claims.internal_id).toBeUndefined();
  });

  it('throws when the token has no subject', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: undefined } });

    await expect(provider.verify('some.token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when verification fails', async () => {
    mockJwtVerify.mockRejectedValue(new Error('signature verification failed'));

    await expect(provider.verify('bad.token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws when SUPABASE_PROJECT_URL is not configured', async () => {
    const bad = new SupabaseIdentityProvider({
      get: jest.fn(() => undefined),
    } as unknown as ConfigService);

    await expect(bad.verify('some.token')).rejects.toThrow(
      'SUPABASE_PROJECT_URL (or SUPABASE_JWKS_URL) not configured',
    );
  });
});
