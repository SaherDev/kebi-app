import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Fallback `app_metadata` key name used only when KEBI_APP_METADATA_FIELD is
 * unset. In real environments set a random, non-descriptive name there so the
 * token gives no hint which key holds our sealed claims.
 */
const DEFAULT_FIELD = 'kebi';

// Cipher invariants of the scheme — NOT config on purpose. AES-128-GCM with a
// 12-byte IV and 16-byte tag is the chosen construction; exposing these as
// runtime config would invite an accidental downgrade. The key (secret) and the
// field name (random, obscurity) are the only environment-specific knobs.
const ALGORITHM = 'aes-128-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 16; // AES-128 → 16-byte key (32 hex chars)

/**
 * Authenticated symmetric encryption for the product claims we stamp into
 * Supabase `app_metadata`. Supabase signs (not encrypts) its JWTs, so to keep
 * `internal_id`/`plan` out of view we seal them ourselves: the gateway holds the
 * key (`KEBI_APP_METADATA_KEY`), so the values ride the token claim-first yet
 * are opaque to the token holder. AES-256-GCM also authenticates the blob, so a
 * tampered ciphertext fails to decrypt (on top of the JWT signature).
 *
 * Output layout (base64url): iv(12) || authTag(16) || ciphertext.
 *
 * Fails safe: when the key is unset or a blob can't be decrypted, callers treat
 * it as "no claim" and fall back to the DB resolve — never a hard error.
 */
@Injectable()
export class AppMetadataCipher {
  private readonly logger = new Logger(AppMetadataCipher.name);
  private readonly key: Buffer | null;
  /** The (configurable, ideally random) app_metadata key name we read/write. */
  readonly field: string;

  constructor(configService: ConfigService) {
    this.field =
      configService.get<string>('KEBI_APP_METADATA_FIELD')?.trim() ||
      DEFAULT_FIELD;

    const raw = configService.get<string>('KEBI_APP_METADATA_KEY')?.trim();
    let key: Buffer | null = null;
    if (raw) {
      const buf = Buffer.from(raw, 'hex');
      if (buf.length === KEY_BYTES) key = buf;
      else
        this.logger.error(
          `KEBI_APP_METADATA_KEY must be ${KEY_BYTES} bytes hex (${KEY_BYTES * 2} chars) — app_metadata encryption disabled.`,
        );
    }
    this.key = key;
  }

  /** True when a valid key is configured and encrypt/decrypt will operate. */
  isConfigured(): boolean {
    return this.key !== null;
  }

  /** Seal an object into a base64url blob. Throws only if misused without a key. */
  encrypt(payload: Record<string, unknown>): string {
    if (!this.key) {
      throw new Error('AppMetadataCipher.encrypt called without a configured key');
    }
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(payload), 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
  }

  /** Open a blob produced by encrypt(). Returns null on any failure (fail safe). */
  decrypt(blob: string): Record<string, unknown> | null {
    if (!this.key) return null;
    try {
      const buf = Buffer.from(blob, 'base64url');
      const iv = buf.subarray(0, IV_BYTES);
      const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
      const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);
      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');
      return JSON.parse(plaintext) as Record<string, unknown>;
    } catch (error) {
      this.logger.warn(
        `Failed to decrypt app_metadata blob: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
