import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { SupabaseProfileWriter } from './supabase-profile.writer';

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const config: Record<string, unknown> = {
        SUPABASE_PROJECT_URL: 'https://ref.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
        ...overrides,
      };
      return key in config ? config[key] : defaultValue;
    }),
  } as unknown as ConfigService;
}

describe('SupabaseProfileWriter', () => {
  let http: { put: jest.Mock };

  beforeEach(() => {
    http = { put: jest.fn().mockReturnValue(of({ data: {} })) };
  });

  function make(configOverrides: Record<string, unknown> = {}) {
    return new SupabaseProfileWriter(
      makeConfig(configOverrides),
      http as unknown as HttpService,
    );
  }

  it('PUTs user_metadata.name to the admin endpoint with service-role auth', async () => {
    await make().setName('uuid-1', 'saher');

    expect(http.put).toHaveBeenCalledWith(
      'https://ref.supabase.co/auth/v1/admin/users/uuid-1',
      { user_metadata: { name: 'saher' } },
      expect.objectContaining({
        headers: {
          apikey: 'service-role-secret',
          Authorization: 'Bearer service-role-secret',
        },
      }),
    );
  });

  it('throws (does not swallow) when the service-role key is unset', async () => {
    await expect(make({ SUPABASE_SERVICE_ROLE_KEY: undefined }).setName('u', 'x')).rejects.toThrow();
    expect(http.put).not.toHaveBeenCalled();
  });

  it('propagates an admin HTTP error so callers can surface it', async () => {
    http.put.mockReturnValue(throwError(() => new Error('500 admin error')));
    await expect(make().setName('uuid-2', 'nope')).rejects.toThrow('500 admin error');
  });
});
