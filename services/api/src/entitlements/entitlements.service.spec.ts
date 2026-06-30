import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { EntitlementsService } from './entitlements.service';
import { Entitlements } from './entitlements';

// Mirrors the app.yaml entitlements.plans matrix (ADR-112): explorer/legend omit
// the numeric limits to mean unlimited.
function makeConfig() {
  const values: Record<string, unknown> = {
    'entitlements.plans.homebody': {
      taste_enabled: false,
      discovery_enabled: false,
      advanced_models_enabled: false,
      save_limit: 10,
      consults_per_day: 3,
    },
    'entitlements.plans.explorer': {
      taste_enabled: true,
      discovery_enabled: false,
      advanced_models_enabled: false,
    },
    'entitlements.plans.local_legend': {
      taste_enabled: true,
      discovery_enabled: true,
      advanced_models_enabled: true,
    },
  };
  return {
    get: jest.fn((key: string, dflt?: unknown) => (key in values ? values[key] : dflt)),
  } as unknown as ConfigService;
}

describe('EntitlementsService.resolve', () => {
  let service: EntitlementsService;

  beforeEach(() => {
    service = new EntitlementsService(makeConfig());
  });

  it('resolves homebody — paid features off, capped at 10 saves / 3 consults', () => {
    const ent = service.resolve('homebody');
    expect(ent).toBeInstanceOf(Entitlements);
    expect(ent).toEqual({
      taste_enabled: false,
      discovery_enabled: false,
      advanced_models_enabled: false,
      save_limit: 10,
      consults_per_day: 3,
    });
  });

  it('resolves explorer — taste on, limits unlimited (null)', () => {
    expect(service.resolve('explorer')).toEqual({
      taste_enabled: true,
      discovery_enabled: false,
      advanced_models_enabled: false,
      save_limit: null,
      consults_per_day: null,
    });
  });

  it('resolves local_legend — everything on, unlimited', () => {
    expect(service.resolve('local_legend')).toEqual({
      taste_enabled: true,
      discovery_enabled: true,
      advanced_models_enabled: true,
      save_limit: null,
      consults_per_day: null,
    });
  });

  it('falls back to homebody for an undefined plan', () => {
    expect(service.resolve()).toEqual(service.resolve('homebody'));
  });

  it('falls back to homebody for an unknown plan', () => {
    expect(service.resolve('pro' as never)).toEqual(service.resolve('homebody'));
  });
});
