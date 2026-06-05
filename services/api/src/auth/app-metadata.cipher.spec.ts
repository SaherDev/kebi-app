import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { AppMetadataCipher } from './app-metadata.cipher';

const KEY = 'a'.repeat(32); // 16 bytes hex (AES-128)

function cipher(overrides: Record<string, unknown> = {}) {
  const config: Record<string, unknown> = {
    KEBI_APP_METADATA_KEY: KEY,
    KEBI_APP_METADATA_FIELD: 'kebi_xq9',
    ...overrides,
  };
  return new AppMetadataCipher({
    get: jest.fn((k: string, d?: unknown) => (k in config ? config[k] : d)),
  } as unknown as ConfigService);
}

describe('AppMetadataCipher', () => {
  it('round-trips a payload through encrypt/decrypt', () => {
    const c = cipher();
    const payload = { internal_id: 'user_abc', plan: 'explorer', ai_enabled: true };
    const blob = c.encrypt(payload);

    expect(typeof blob).toBe('string');
    expect(blob).not.toContain('user_abc'); // opaque, not readable
    expect(c.decrypt(blob)).toEqual(payload);
  });

  it('produces a different ciphertext each call (random IV) but same plaintext', () => {
    const c = cipher();
    const a = c.encrypt({ internal_id: 'x' });
    const b = c.encrypt({ internal_id: 'x' });
    expect(a).not.toBe(b);
    expect(c.decrypt(a)).toEqual(c.decrypt(b));
  });

  it('returns null when decrypting with a different key (authentication fails)', () => {
    const blob = cipher().encrypt({ internal_id: 'secret' });
    const other = cipher({ KEBI_APP_METADATA_KEY: 'b'.repeat(32) });
    expect(other.decrypt(blob)).toBeNull();
  });

  it('returns null on a tampered blob', () => {
    const c = cipher();
    const blob = c.encrypt({ internal_id: 'x' });
    const tampered = blob.slice(0, -2) + (blob.endsWith('A') ? 'B' : 'A');
    expect(c.decrypt(tampered)).toBeNull();
  });

  it('exposes the configured field name', () => {
    expect(cipher().field).toBe('kebi_xq9');
  });

  it('falls back to the default field name when unset', () => {
    expect(cipher({ KEBI_APP_METADATA_FIELD: undefined }).field).toBe('kebi');
  });

  it('is not configured (and decrypt returns null) without a key', () => {
    const c = cipher({ KEBI_APP_METADATA_KEY: undefined });
    expect(c.isConfigured()).toBe(false);
    expect(c.decrypt('anything')).toBeNull();
  });

  it('is not configured when the key is the wrong length', () => {
    expect(cipher({ KEBI_APP_METADATA_KEY: 'abc' }).isConfigured()).toBe(false);
  });
});
