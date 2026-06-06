import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { SupabaseIdentityProvider } from './supabase-identity.provider';
import { AppMetadataCipher } from '../app-metadata.cipher';
import * as jose from 'jose';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => jest.fn()),
  jwtVerify: jest.fn(),
}));

const TEST_KEY = 'a'.repeat(32); // 16 bytes hex (AES-128)
const TEST_FIELD = 'kebi_xq9';

function makeConfig(overrides: Record<string, unknown> = {}) {
  const config: Record<string, unknown> = {
    SUPABASE_PROJECT_URL: 'https://ref.supabase.co',
    KEBI_APP_METADATA_KEY: TEST_KEY,
    KEBI_APP_METADATA_FIELD: TEST_FIELD,
    'user_settings.defaults.ai_enabled': true,
    ...overrides,
  };
  return {
    get: jest.fn((key: string, def?: unknown) =>
      key in config ? config[key] : def,
    ),
  } as unknown as ConfigService;
}

describe('SupabaseIdentityProvider', () => {
  let provider: SupabaseIdentityProvider;
  let cipher: AppMetadataCipher;
  let mockJwtVerify: jest.Mock;
  let mockCreateRemoteJWKSet: jest.Mock;

  beforeEach(async () => {
    mockJwtVerify = jose.jwtVerify as unknown as jest.Mock;
    mockCreateRemoteJWKSet = jose.createRemoteJWKSet as unknown as jest.Mock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseIdentityProvider,
        AppMetadataCipher,
        { provide: ConfigService, useValue: makeConfig() },
      ],
    }).compile();

    provider = module.get(SupabaseIdentityProvider);
    cipher = module.get(AppMetadataCipher);
  });

  afterEach(() => jest.clearAllMocks());

  it('exposes the provider name "supabase"', () => {
    expect(provider.name).toBe('supabase');
  });

  it('maps the sub to externalId and decrypts claims from the sealed field', async () => {
    const blob = cipher.encrypt({
      ai_enabled: false,
      plan: 'explorer',
      internal_id: 'user_abc',
    });
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: 'uuid-123',
        email: 'user@example.com',
        app_metadata: { provider: 'email', [TEST_FIELD]: blob },
      },
    });

    const identity = await provider.verify('valid.token');

    expect(identity.externalId).toBe('uuid-123');
    expect(identity.claims.ai_enabled).toBe(false);
    expect(identity.claims.plan).toBe('explorer');
    expect(identity.claims.internal_id).toBe('user_abc');
  });

  it('ignores unencrypted/foreign app_metadata keys (only the sealed field counts)', async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: 'uuid-789',
        // Tampered plaintext claims must NOT be read — no valid sealed blob here.
        app_metadata: { provider: 'email', plan: 'local_legend', internal_id: 'forged' },
      },
    });

    const identity = await provider.verify('valid.token');

    expect(identity.claims.plan).toBeUndefined();
    expect(identity.claims.internal_id).toBeUndefined();
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

  it('treats a blank SUPABASE_JWKS_URL as unset and derives from the project url', async () => {
    const bad = new SupabaseIdentityProvider(
      makeConfig({ SUPABASE_JWKS_URL: '   ' }),
      cipher,
    );
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'uuid-blank' } });

    await expect(bad.verify('valid.token')).resolves.toMatchObject({
      externalId: 'uuid-blank',
    });
    expect(mockCreateRemoteJWKSet).toHaveBeenCalledWith(
      new URL('https://ref.supabase.co/auth/v1/.well-known/jwks.json'),
    );
  });

  it('leaves claims undefined (no defaults) when no sealed blob is present', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'uuid-456' } });

    const identity = await provider.verify('valid.token');

    expect(identity.claims.ai_enabled).toBeUndefined();
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
    const bad = new SupabaseIdentityProvider(
      { get: jest.fn(() => undefined) } as unknown as ConfigService,
      cipher,
    );

    await expect(bad.verify('some.token')).rejects.toThrow(
      'SUPABASE_PROJECT_URL (or SUPABASE_JWKS_URL) not configured',
    );
  });
});
