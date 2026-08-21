import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { isDeployedEnvironment, resolveSchemaSynchronize } from './deployment';

function makeConfig(vars: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => vars[key]),
  } as unknown as ConfigService;
}

describe('isDeployedEnvironment', () => {
  it('is false with no runtime markers (local dev)', () => {
    expect(isDeployedEnvironment(makeConfig({}))).toBe(false);
  });

  it('is true when RAILWAY_ENVIRONMENT is present, whatever its value', () => {
    expect(
      isDeployedEnvironment(makeConfig({ RAILWAY_ENVIRONMENT: 'production' })),
    ).toBe(true);
    // Presence alone is the signal — staging is as deployed as production.
    expect(
      isDeployedEnvironment(makeConfig({ RAILWAY_ENVIRONMENT: 'staging' })),
    ).toBe(true);
  });

  it('is true when NODE_ENV is production (non-Railway hosts)', () => {
    expect(isDeployedEnvironment(makeConfig({ NODE_ENV: 'production' }))).toBe(true);
  });
});

describe('resolveSchemaSynchronize', () => {
  it('is off by default', () => {
    expect(resolveSchemaSynchronize(makeConfig({}))).toBe(false);
  });

  it('honours DB_SYNCHRONIZE=true locally', () => {
    expect(resolveSchemaSynchronize(makeConfig({ DB_SYNCHRONIZE: 'true' }))).toBe(true);
  });

  it('refuses DB_SYNCHRONIZE=true when running deployed', () => {
    // The env var was accidentally true on production once; auto-sync against
    // real user data must be impossible, not merely configured off.
    expect(
      resolveSchemaSynchronize(
        makeConfig({ DB_SYNCHRONIZE: 'true', RAILWAY_ENVIRONMENT: 'production' }),
      ),
    ).toBe(false);
    expect(
      resolveSchemaSynchronize(
        makeConfig({ DB_SYNCHRONIZE: 'true', NODE_ENV: 'production' }),
      ),
    ).toBe(false);
  });
});
