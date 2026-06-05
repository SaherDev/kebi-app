import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { SupabaseMetadataWriter } from './supabase-metadata.writer';
import { AppMetadataCipher } from '../app-metadata.cipher';

const TEST_KEY = 'a'.repeat(32); // 16 bytes hex (AES-128)
const TEST_FIELD = 'kebi_xq9';

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const config: Record<string, unknown> = {
        SUPABASE_PROJECT_URL: 'https://ref.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
        KEBI_APP_METADATA_KEY: TEST_KEY,
        KEBI_APP_METADATA_FIELD: TEST_FIELD,
        ...overrides,
      };
      return key in config ? config[key] : defaultValue;
    }),
  } as unknown as ConfigService;
}

describe('SupabaseMetadataWriter', () => {
  let http: { put: jest.Mock };
  let cipher: AppMetadataCipher;

  beforeEach(() => {
    http = { put: jest.fn().mockReturnValue(of({ data: {} })) };
    cipher = new AppMetadataCipher(makeConfig());
  });

  function make(configOverrides: Record<string, unknown> = {}) {
    const config = makeConfig(configOverrides);
    return new SupabaseMetadataWriter(
      config,
      http as unknown as HttpService,
      new AppMetadataCipher(config),
    );
  }

  /** Pull the encrypted blob out of the PUT body and decrypt it for assertions. */
  function sealedFromPut(): Record<string, unknown> | null {
    const body = http.put.mock.calls[0][1] as { app_metadata: Record<string, string> };
    return cipher.decrypt(body.app_metadata[TEST_FIELD]);
  }

  it('PUTs an encrypted blob under the configured field, not plaintext claims', async () => {
    const writer = make();

    await writer.stamp('uuid-1', {
      internal_id: 'user_abc',
      plan: 'explorer',
      ai_enabled: true,
    });

    const body = http.put.mock.calls[0][1] as { app_metadata: Record<string, unknown> };
    // Only the sealed field is present — no readable internal_id/plan.
    expect(Object.keys(body.app_metadata)).toEqual([TEST_FIELD]);
    expect(JSON.stringify(body.app_metadata)).not.toContain('user_abc');
    expect(sealedFromPut()).toEqual({
      internal_id: 'user_abc',
      plan: 'explorer',
      ai_enabled: true,
    });
    expect(http.put).toHaveBeenCalledWith(
      'https://ref.supabase.co/auth/v1/admin/users/uuid-1',
      expect.anything(),
      expect.objectContaining({
        headers: {
          apikey: 'service-role-secret',
          Authorization: 'Bearer service-role-secret',
        },
      }),
    );
  });

  it('omits undefined optional claims from the sealed payload', async () => {
    const writer = make();
    await writer.stamp('uuid-2', { internal_id: 'user_only' });
    expect(sealedFromPut()).toEqual({ internal_id: 'user_only' });
  });

  it('skips (no HTTP) when the service-role key is unset', async () => {
    const writer = make({ SUPABASE_SERVICE_ROLE_KEY: undefined });
    await expect(
      writer.stamp('uuid-3', { internal_id: 'user_x' }),
    ).resolves.toBeUndefined();
    expect(http.put).not.toHaveBeenCalled();
  });

  it('skips (no HTTP) when the encryption key is unset', async () => {
    const writer = make({ KEBI_APP_METADATA_KEY: undefined });
    await expect(
      writer.stamp('uuid-3b', { internal_id: 'user_x' }),
    ).resolves.toBeUndefined();
    expect(http.put).not.toHaveBeenCalled();
  });

  it('dedupes repeated stamps for the same user within the TTL window', async () => {
    const writer = make();
    await writer.stamp('uuid-4', { internal_id: 'user_y' });
    await writer.stamp('uuid-4', { internal_id: 'user_y' });
    expect(http.put).toHaveBeenCalledTimes(1);
  });

  it('does not record a successful stamp when the admin call fails', async () => {
    http.put
      .mockReturnValueOnce(throwError(() => new Error('500 admin error')))
      .mockReturnValueOnce(of({ data: {} }));
    const writer = make();

    await expect(
      writer.stamp('uuid-5', { internal_id: 'user_z' }),
    ).resolves.toBeUndefined();
    await writer.stamp('uuid-5', { internal_id: 'user_z' });

    expect(http.put).toHaveBeenCalledTimes(2);
  });
});
