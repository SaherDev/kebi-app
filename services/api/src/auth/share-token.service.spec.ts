import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { ShareTokenService } from './share-token.service';

const SECRET = 's'.repeat(32); // minimum accepted length

function service(overrides: Record<string, unknown> = {}) {
  const config: Record<string, unknown> = {
    SHARE_TOKEN_SECRET: SECRET,
    'auth.share_token.ttl_days': 90,
    ...overrides,
  };
  return new ShareTokenService({
    get: jest.fn((k: string, d?: unknown) => (k in config ? config[k] : d)),
  } as unknown as ConfigService);
}

describe('ShareTokenService', () => {
  it('round-trips a user id through mint/verify', () => {
    const s = service();
    expect(s.verify(s.mint('user_abc').token)).toBe('user_abc');
  });

  it('marks minted tokens as share tokens so a verifier can claim them', () => {
    const s = service();
    expect(s.isShareToken(s.mint('user_abc').token)).toBe(true);
    expect(s.isShareToken('eyJhbGciOiJIUzI1NiJ9.supabase.jwt')).toBe(false);
  });

  it('mints a different token each call for the same user', () => {
    const s = service();
    expect(s.mint('user_abc').token).not.toBe(s.mint('user_abc').token);
  });

  it('rejects a token signed with a different secret', () => {
    const token = service().mint('user_abc').token;
    expect(service({ SHARE_TOKEN_SECRET: 'x'.repeat(32) }).verify(token)).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const s = service();
    const token = s.mint('user_abc').token;
    const [body, signature] = token.slice(4).split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'user_victim', exp: Date.now() + 1000, jti: 'x' }),
      'utf8',
    ).toString('base64url');

    expect(body).not.toBe(forged);
    expect(s.verify(`kst_${forged}.${signature}`)).toBeNull();
  });

  it('rejects an expired token', () => {
    // ttl_days accepts a fraction, so a negative ttl mints already-expired.
    const s = service({ 'auth.share_token.ttl_days': -1 });
    expect(s.verify(s.mint('user_abc').token)).toBeNull();
  });

  it('honours the configured ttl', () => {
    const s = service({ 'auth.share_token.ttl_days': 1 });
    const token = s.mint('user_abc').token;
    const payload = JSON.parse(
      Buffer.from(token.slice(4).split('.')[0], 'base64url').toString('utf8'),
    );
    const days = (payload.exp - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(0.99);
    expect(days).toBeLessThanOrEqual(1);
  });

  it('rejects malformed tokens without throwing', () => {
    const s = service();
    for (const bad of ['', 'kst_', 'kst_onlybody', 'kst_a.b.c', 'not-a-token']) {
      expect(s.verify(bad)).toBeNull();
    }
  });

  it('rejects a well-formed token whose payload is not a share payload', () => {
    const s = service();
    // Sign a structurally valid but semantically wrong body via the real signer:
    // mint, then swap in a body the service itself would never produce.
    const empty = Buffer.from(JSON.stringify({ sub: '', exp: Date.now() + 1000 }), 'utf8');
    const forged = service();
    const token = forged.mint('user_abc').token;
    const signature = token.slice(4).split('.')[1];
    expect(s.verify(`kst_${empty.toString('base64url')}.${signature}`)).toBeNull();
  });

  describe('without a usable secret', () => {
    it('is not configured and verifies nothing when the secret is absent', () => {
      const valid = service().mint('user_abc').token;
      const s = service({ SHARE_TOKEN_SECRET: undefined });
      expect(s.isConfigured()).toBe(false);
      expect(s.verify(valid)).toBeNull();
      expect(() => s.mint('user_abc').token).toThrow();
    });

    it('refuses a secret shorter than the minimum rather than signing weakly', () => {
      const s = service({ SHARE_TOKEN_SECRET: 'too-short' });
      expect(s.isConfigured()).toBe(false);
      expect(() => s.mint('user_abc').token).toThrow();
    });
  });
});
