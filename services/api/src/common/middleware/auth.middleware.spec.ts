import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { NormalizedIdentity } from '@kebi-app/shared';
import { AuthMiddleware } from './auth.middleware';
import {
  IDENTITY_PROVIDER,
  IdentityProvider,
} from '../../auth/identity-provider.interface';
import { IDENTITY_METADATA_WRITER } from '../../auth/identity-metadata.writer';
import { UserIdentityService } from '../../auth/user-identity.service';

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

describe('AuthMiddleware', () => {
  let middleware: AuthMiddleware;
  let provider: jest.Mocked<IdentityProvider>;
  let metadataWriter: { stamp: jest.Mock };
  let userIdentity: { resolve: jest.Mock };

  beforeEach(async () => {
    provider = { name: 'supabase', verify: jest.fn() };
    metadataWriter = { stamp: jest.fn().mockResolvedValue(undefined) };
    userIdentity = { resolve: jest.fn().mockResolvedValue('user_internal_1') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthMiddleware,
        { provide: ConfigService, useValue: makeConfig() },
        { provide: IDENTITY_PROVIDER, useValue: provider },
        { provide: IDENTITY_METADATA_WRITER, useValue: metadataWriter },
        { provide: UserIdentityService, useValue: userIdentity },
      ],
    }).compile();

    middleware = module.get(AuthMiddleware);
  });

  afterEach(() => jest.clearAllMocks());

  it('skips verification for a public route under the global api prefix', async () => {
    const mw = new AuthMiddleware(
      makeConfig({ 'app.api_prefix': 'api/v1' }),
      provider,
      metadataWriter,
      userIdentity as unknown as UserIdentityService,
    );
    const req = { originalUrl: '/api/v1/health', headers: {} } as any;
    const next = jest.fn();

    await mw.use(req, {} as any, next);

    expect(next).toHaveBeenCalled();
    expect(provider.verify).not.toHaveBeenCalled();
  });

  it('throws when the Authorization header is missing', async () => {
    const req = { headers: {}, method: 'GET', path: '/test' } as any;
    const next = jest.fn();

    await expect(middleware.use(req, {} as any, next)).rejects.toThrow(
      'Missing or invalid Authorization header',
    );
  });

  it('forwards the internal id from the signed claim without a DB hit', async () => {
    const identity: NormalizedIdentity = {
      externalId: 'user_123',
      claims: { ai_enabled: false, plan: 'explorer', internal_id: 'user_internal_1' },
    };
    provider.verify.mockResolvedValue(identity);

    const req = { headers: { authorization: 'Bearer tok' } } as any;
    const next = jest.fn();

    await middleware.use(req, {} as any, next);

    expect(provider.verify).toHaveBeenCalledWith('tok');
    expect(req.user?.id).toBe('user_internal_1'); // internal id, never the externalId
    expect(req.user?.ai_enabled).toBe(false);
    expect(req.user?.plan).toBe('explorer');
    expect(userIdentity.resolve).not.toHaveBeenCalled(); // claim present → no DB
    expect(metadataWriter.stamp).not.toHaveBeenCalled(); // already stamped
    expect(next).toHaveBeenCalled();
  });

  it('resolves the internal id via the DB fallback when the claim is absent', async () => {
    provider.verify.mockResolvedValue({ externalId: 'user_123', claims: {} });

    const req = { headers: { authorization: 'Bearer tok' } } as any;
    await middleware.use(req, {} as any, jest.fn());

    expect(userIdentity.resolve).toHaveBeenCalledWith('supabase', {
      externalId: 'user_123',
      claims: {},
    });
    expect(req.user?.id).toBe('user_internal_1'); // value returned by resolve()
  });

  it('stamps the resolved id + default plan back into token metadata on fallback', async () => {
    provider.verify.mockResolvedValue({ externalId: 'user_123', claims: {} });

    const req = { headers: { authorization: 'Bearer tok' } } as any;
    await middleware.use(req, {} as any, jest.fn());

    expect(metadataWriter.stamp).toHaveBeenCalledWith('user_123', {
      internal_id: 'user_internal_1',
      ai_enabled: true,
      plan: 'homebody', // rate_limits.default_plan
    });
  });

  it('defaults ai_enabled to true when the claim is absent', async () => {
    provider.verify.mockResolvedValue({ externalId: 'user_456', claims: {} });

    const req = { headers: { authorization: 'Bearer tok' } } as any;
    const next = jest.fn();

    await middleware.use(req, {} as any, next);

    expect(req.user?.ai_enabled).toBe(true);
  });

  it('throws UnauthorizedException when the provider rejects', async () => {
    provider.verify.mockRejectedValue(new Error('bad token'));

    const req = {
      headers: { authorization: 'Bearer bad' },
      method: 'GET',
      path: '/test',
    } as any;
    const next = jest.fn();

    await expect(middleware.use(req, {} as any, next)).rejects.toThrow(
      'Invalid or expired token',
    );
  });
});
