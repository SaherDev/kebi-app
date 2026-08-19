import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NormalizedIdentity } from '@kebi-app/shared';
import { AuthMiddleware } from './auth.middleware';
import {
  IDENTITY_PROVIDER,
  IdentityProvider,
} from '../../auth/identity-provider.interface';
import { ShareTokenService } from '../../auth/share-token.service';
import { UserSettingsService } from '../../auth/user-settings.service';

const SHARE_SECRET = 's'.repeat(32);

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const config: Record<string, unknown> = {
        'user_settings.defaults.ai_enabled': true,
        'user_settings.defaults.plan': 'homebody',
        SHARE_TOKEN_SECRET: SHARE_SECRET,
        ...overrides,
      };
      return key in config ? config[key] : defaultValue;
    }),
  } as unknown as ConfigService;
}

/** Real ShareTokenService (it is pure crypto — mocking it would test nothing). */
function makeShareTokens(overrides: Record<string, unknown> = {}) {
  return new ShareTokenService(makeConfig(overrides));
}

/** Settings resolved for a share-token principal — the source of truth (ADR-045). */
function makeUserSettings(settings: Record<string, unknown> = {}) {
  return {
    ensureForUser: jest.fn().mockResolvedValue({
      ai_enabled: true,
      plan: 'explorer',
      can_curate: false,
      ...settings,
    }),
  } as unknown as jest.Mocked<UserSettingsService>;
}

describe('AuthMiddleware', () => {
  let middleware: AuthMiddleware;
  let provider: jest.Mocked<IdentityProvider>;
  let userSettings: jest.Mocked<UserSettingsService>;

  beforeEach(async () => {
    provider = { name: 'supabase', verify: jest.fn() };
    userSettings = makeUserSettings();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthMiddleware,
        { provide: ConfigService, useValue: makeConfig() },
        { provide: IDENTITY_PROVIDER, useValue: provider },
        { provide: ShareTokenService, useValue: makeShareTokens() },
        { provide: UserSettingsService, useValue: userSettings },
      ],
    }).compile();

    middleware = module.get(AuthMiddleware);
  });

  afterEach(() => jest.clearAllMocks());

  it('skips verification for a public route under the global api prefix', async () => {
    const mw = new AuthMiddleware(
      makeConfig({ 'app.api_prefix': 'api/v1' }),
      provider,
      makeShareTokens(),
      makeUserSettings(),
    );
    const req = { originalUrl: '/api/v1/health', headers: {} } as any;
    const next = jest.fn();

    await mw.use(req, {} as any, next);

    expect(next).toHaveBeenCalled();
    expect(provider.verify).not.toHaveBeenCalled();
  });

  it('attaches an identity on the dev bypass, not just a principal', async () => {
    // Without it, every settings write 500s on the bypass path: the setters read
    // externalId off the identity to re-stamp the token claims.
    const mw = new AuthMiddleware(
      makeConfig({
        APP_DEV_BYPASS_ENABLED: 'true',
        DEV_BYPASS_TOKEN: 'local-token',
        DEV_BYPASS_USER_ID: 'user_local_1',
      }),
      provider,
      makeShareTokens(),
      makeUserSettings(),
    );
    const req = {
      headers: { authorization: 'Bearer local-token' },
      method: 'GET',
      path: '/user/settings',
    } as any;
    const next = jest.fn();

    await mw.use(req, {} as any, next);

    expect(next).toHaveBeenCalled();
    expect(req.user?.id).toBe('user_local_1');
    expect(req.identity?.externalId).toBe('user_local_1');
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
    const mw = new AuthMiddleware(
      makeConfig({ 'app.api_prefix': 'api/v1' }),
      provider,
      makeShareTokens(),
      makeUserSettings(),
    );
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

  describe('share token (iOS share extension)', () => {
    function shareRequest(token: string, url = '/api/v1/extract') {
      return { headers: { authorization: `Bearer ${token}` }, originalUrl: url } as any;
    }

    function shareMiddleware(
      shareTokens = makeShareTokens(),
      settings = userSettings,
      configOverrides: Record<string, unknown> = {},
    ) {
      return new AuthMiddleware(
        makeConfig({ 'app.api_prefix': 'api/v1', ...configOverrides }),
        provider,
        shareTokens,
        settings,
      );
    }

    it('authenticates the save route without ever calling the identity provider', async () => {
      const shareTokens = makeShareTokens();
      const mw = shareMiddleware(shareTokens);
      const next = jest.fn();
      const req = shareRequest(shareTokens.mint('user_abc').token);

      await mw.use(req, {} as any, next);

      expect(next).toHaveBeenCalled();
      expect(req.user?.id).toBe('user_abc');
      // A share token is not a session — no provider identity exists for it.
      expect(provider.verify).not.toHaveBeenCalled();
      expect(req.identity).toBeUndefined();
    });

    it('resolves the principal from user_settings, not from the token', async () => {
      // The token is 90 days old by design; a stamped plan would be that stale.
      const shareTokens = makeShareTokens();
      const settings = makeUserSettings({ plan: 'local_legend', ai_enabled: false });
      const mw = shareMiddleware(shareTokens, settings);
      const req = shareRequest(shareTokens.mint('user_abc').token);

      await mw.use(req, {} as any, jest.fn());

      expect(settings.ensureForUser).toHaveBeenCalledWith('user_abc');
      expect(req.user?.plan).toBe('local_legend');
      expect(req.user?.ai_enabled).toBe(false);
    });

    it('rejects a share token aimed at a route outside its scope', async () => {
      const shareTokens = makeShareTokens();
      const mw = shareMiddleware(shareTokens);
      const req = shareRequest(shareTokens.mint('user_abc').token, '/api/v1/user/data');
      const next = jest.fn();

      await expect(mw.use(req, {} as any, next)).rejects.toThrow(
        'Token is not valid for this route',
      );
      expect(next).not.toHaveBeenCalled();
      expect(userSettings.ensureForUser).not.toHaveBeenCalled();
    });

    it('rejects an expired share token instead of retrying it as a session token', async () => {
      const expired = makeShareTokens({ 'auth.share_token.ttl_days': -1 });
      const mw = shareMiddleware(expired);
      const req = shareRequest(expired.mint('user_abc').token);

      await expect(mw.use(req, {} as any, jest.fn())).rejects.toThrow(
        'Invalid or expired token',
      );
      expect(provider.verify).not.toHaveBeenCalled();
    });

    it('rejects a share token forged against a different secret', async () => {
      const attacker = makeShareTokens({ SHARE_TOKEN_SECRET: 'x'.repeat(32) });
      const mw = shareMiddleware();
      const req = shareRequest(attacker.mint('user_victim').token);

      await expect(mw.use(req, {} as any, jest.fn())).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('leaves a Supabase token to the provider path untouched', async () => {
      const identity: NormalizedIdentity = {
        externalId: 'user_123',
        claims: { ai_enabled: true, internal_id: 'user_internal_1' },
      };
      provider.verify.mockResolvedValue(identity);
      const mw = shareMiddleware();
      const req = shareRequest('eyJhbGciOiJIUzI1NiJ9.a.b');

      await mw.use(req, {} as any, jest.fn());

      expect(provider.verify).toHaveBeenCalled();
      expect(req.user?.id).toBe('user_internal_1');
      expect(userSettings.ensureForUser).not.toHaveBeenCalled();
    });

    it('rejects share tokens entirely when no secret is configured', async () => {
      const shareTokens = makeShareTokens();
      const token = shareTokens.mint('user_abc').token;
      const mw = shareMiddleware(makeShareTokens({ SHARE_TOKEN_SECRET: undefined }));

      await expect(mw.use(shareRequest(token), {} as any, jest.fn())).rejects.toThrow(
        'Invalid or expired token',
      );
    });
  });
});
