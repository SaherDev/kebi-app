import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { MovementProfile, UserSettingsData } from '@kebi-app/shared';
import { UserSettingsService } from './user-settings.service';
import { UserSettingsRepository } from './user-settings.repository';
import { UserSettingsEntity } from '../database/entities/user-settings.entity';

const MOVEMENT: MovementProfile = { available_modes: ['driving'], reach: 'compact' };

// Config returns non-default values so we can prove the defaults come from config.
function makeConfig() {
  const values: Record<string, unknown> = {
    'user_settings.defaults.plan': 'explorer',
    'user_settings.defaults.ai_enabled': false,
    'user_settings.defaults.movement_profile': MOVEMENT,
  };
  return {
    get: jest.fn((key: string, dflt?: unknown) => (key in values ? values[key] : dflt)),
  } as unknown as ConfigService;
}

function rowWith(settings: UserSettingsData): UserSettingsEntity {
  return { id: 's1', userId: 'user_1', settings } as UserSettingsEntity;
}

describe('UserSettingsService.ensureForUser', () => {
  let service: UserSettingsService;
  let repo: jest.Mocked<UserSettingsRepository>;

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<UserSettingsRepository>;
    service = new UserSettingsService(makeConfig(), repo);
  });

  afterEach(() => jest.clearAllMocks());

  it('creates settings with config-seeded defaults on first sight', async () => {
    repo.findByUserId.mockResolvedValue(null);
    repo.create.mockImplementation((_userId: string, settings: UserSettingsData) =>
      Promise.resolve(rowWith(settings)),
    );

    const settings = await service.ensureForUser('user_1');

    expect(repo.create).toHaveBeenCalledWith('user_1', {
      plan: 'explorer',
      ai_enabled: false,
      movement_profile: MOVEMENT,
    });
    expect(settings.plan).toBe('explorer');
  });

  it('returns the existing settings without creating', async () => {
    const existing: UserSettingsData = {
      plan: 'local_legend',
      ai_enabled: true,
      movement_profile: null,
    };
    repo.findByUserId.mockResolvedValue(rowWith(existing));

    const settings = await service.ensureForUser('user_1');

    expect(settings).toEqual(existing);
    expect(repo.create).not.toHaveBeenCalled();
  });

  describe('updatePlan', () => {
    it('writes the new plan, preserving the other settings, and returns the new doc', async () => {
      const existing: UserSettingsData = {
        plan: 'homebody',
        ai_enabled: true,
        movement_profile: MOVEMENT,
      };
      repo.findByUserId.mockResolvedValue(rowWith(existing));
      repo.update.mockImplementation((_userId: string, settings: UserSettingsData) =>
        Promise.resolve(rowWith(settings)),
      );

      const next = await service.updatePlan('user_1', 'explorer');

      expect(repo.update).toHaveBeenCalledWith('user_1', {
        plan: 'explorer',
        ai_enabled: true,
        movement_profile: MOVEMENT,
      });
      expect(next.plan).toBe('explorer');
    });
  });

  it('re-reads the winner when the create loses the unique-constraint race', async () => {
    const winner: UserSettingsData = { plan: 'homebody', ai_enabled: true, movement_profile: null };
    repo.findByUserId
      .mockResolvedValueOnce(null) // initial lookup
      .mockResolvedValueOnce(rowWith(winner)); // post-conflict re-read
    repo.create.mockRejectedValue(new Error('duplicate key'));

    const settings = await service.ensureForUser('user_1');

    expect(settings).toEqual(winner);
  });
});
