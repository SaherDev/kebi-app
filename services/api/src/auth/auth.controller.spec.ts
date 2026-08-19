import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '@kebi-app/shared';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ShareTokenService } from './share-token.service';

const SECRET = 's'.repeat(32);

function shareTokens(overrides: Record<string, unknown> = {}) {
  const config: Record<string, unknown> = { SHARE_TOKEN_SECRET: SECRET, ...overrides };
  return new ShareTokenService({
    get: jest.fn((k: string, d?: unknown) => (k in config ? config[k] : d)),
  } as unknown as ConfigService);
}

function controller(tokens = shareTokens()) {
  const authService = { provision: jest.fn() } as unknown as AuthService;
  return { ctrl: new AuthController(authService, tokens), authService, tokens };
}

const USER = { id: 'user_abc', ai_enabled: true } as AuthUser;

describe('AuthController', () => {
  describe('POST /auth/share-token', () => {
    it('mints a token the extension can later authenticate with', () => {
      const { ctrl, tokens } = controller();

      const res = ctrl.shareToken(USER);

      expect(tokens.verify(res.token)).toBe('user_abc');
      expect(res.expires_at).toBeGreaterThan(Date.now());
    });

    it('rejects an unauthenticated caller', () => {
      const { ctrl } = controller();
      expect(() => ctrl.shareToken(undefined)).toThrow('Missing authenticated user');
    });

    it('reports unavailable rather than minting when no secret is configured', () => {
      // The client reads this as "no share token" and falls back to queueing —
      // never as licence to post from the extension unauthenticated.
      const { ctrl } = controller(shareTokens({ SHARE_TOKEN_SECRET: undefined }));
      expect(() => ctrl.shareToken(USER)).toThrow('Share tokens are not configured');
    });
  });
});
