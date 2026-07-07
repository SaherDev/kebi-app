import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NormalizedIdentity } from '@kebi-app/shared';
import { AuthMiddleware } from './auth.middleware';
import {
  IDENTITY_PROVIDER,
  IdentityProvider,
} from '../../auth/identity-provider.interface';

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const config: Record<string, unknown> = {
        'user_settings.defaults.ai_enabled': true,
        'user_settings.defaults.plan': 'homebody',
        ...overrides,
      };
      return key in config ? config[key] : defaultValue;
    }),
  } as unknown as ConfigService;
}

describe('AuthMiddleware', () => {
  let middleware: AuthMiddleware;
  let provider: jest.Mocked<IdentityProvider>;

  beforeEach(async () => {
    provider = { name: 'supabase', verify: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthMiddleware,
        { provide: ConfigService, useValue: makeConfig() },
        { provide: IDENTITY_PROVIDER, useValue: provider },
      ],
    }).compile();

    middleware = module.get(AuthMiddleware);
  });

  afterEach(() => jest.clearAllMocks());

  it('skips verification for a public route under the global api prefix', async () => {
    const mw = new AuthMiddleware(makeConfig({ 'app.api_prefix': 'api/v1' }), provider);
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

  it('attaches the claim-first internal id and the raw identity, no DB hit', async () => {
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
    expect(req.identity).toBe(identity); // raw identity exposed for provisioning
    expect(next).toHaveBeenCalled();
  });

  it('rejects a not-yet-provisioned token on a protected route (no placeholder identity)', async () => {
    provider.verify.mockResolvedValue({ externalId: 'user_456', claims: {} });

    const req = { headers: { authorization: 'Bearer tok' }, originalUrl: '/api/v1/chat' } as any;
    const next = jest.fn();

    await expect(middleware.use(req, {} as any, next)).rejects.toThrow('User not provisioned');
    expect(req.user).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a not-yet-provisioned token through the provisioning route', async () => {
    const mw = new AuthMiddleware(makeConfig({ 'app.api_prefix': 'api/v1' }), provider);
    provider.verify.mockResolvedValue({ externalId: 'user_456', claims: {} });

    const req = { headers: { authorization: 'Bearer tok' }, originalUrl: '/api/v1/auth/login' } as any;
    const next = jest.fn();

    await mw.use(req, {} as any, next);

    expect(next).toHaveBeenCalled();
    expect(req.identity?.externalId).toBe('user_456'); // identity attached for provisioning
    expect(req.user).toBeUndefined(); // no provisioned principal yet
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
