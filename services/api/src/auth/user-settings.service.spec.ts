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
    'user_settings.defaults.can_curate': true,
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
      can_curate: true,
      movement_profile: MOVEMENT,
      about_me: null,
    });
    expect(settings.plan).toBe('explorer');
  });

  it('returns the existing settings without creating', async () => {
    const existing: UserSettingsData = {
      plan: 'local_legend',
      ai_enabled: true,
      can_curate: false,
      movement_profile: null,
      about_me: null,
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
        can_curate: false,
        movement_profile: MOVEMENT,
        about_me: null,
      };
      repo.findByUserId.mockResolvedValue(rowWith(existing));
      repo.update.mockImplementation((_userId: string, settings: UserSettingsData) =>
        Promise.resolve(rowWith(settings)),
      );

      const next = await service.updatePlan('user_1', 'explorer');

      expect(repo.update).toHaveBeenCalledWith('user_1', {
        plan: 'explorer',
        ai_enabled: true,
        can_curate: false,
        movement_profile: MOVEMENT,
        about_me: null,
      });
      expect(next.plan).toBe('explorer');
    });
  });

  describe('updateCanCurate', () => {
    it('grants the curator role, preserving the other settings, and returns the new doc', async () => {
      const existing: UserSettingsData = {
        plan: 'explorer',
        ai_enabled: true,
        can_curate: false,
        movement_profile: MOVEMENT,
        about_me: null,
      };
      repo.findByUserId.mockResolvedValue(rowWith(existing));
      repo.update.mockImplementation((_userId: string, settings: UserSettingsData) =>
        Promise.resolve(rowWith(settings)),
      );

      const next = await service.updateCanCurate('user_1', true);

      expect(repo.update).toHaveBeenCalledWith('user_1', {
        plan: 'explorer',
        ai_enabled: true,
        can_curate: true,
        movement_profile: MOVEMENT,
        about_me: null,
      });
      expect(next.can_curate).toBe(true);
    });
  });

  describe('updateAboutMe', () => {
    const existing: UserSettingsData = {
      plan: 'explorer',
      ai_enabled: true,
      can_curate: false,
      movement_profile: MOVEMENT,
      about_me: null,
    };

    beforeEach(() => {
      repo.findByUserId.mockResolvedValue(rowWith(existing));
      repo.update.mockImplementation((_userId: string, settings: UserSettingsData) =>
        Promise.resolve(rowWith(settings)),
      );
    });

    it('stores the block, preserving the other settings', async () => {
      const aboutMe = { call_me: 'Saher', home_country: 'AE', about: 'I do not drink.' };

      const next = await service.updateAboutMe('user_1', aboutMe);

      expect(next).toEqual({ ...existing, about_me: aboutMe });
    });

    it('stores null when every field was cleared — an empty about-me is no about-me', async () => {
      const next = await service.updateAboutMe('user_1', {
        call_me: null,
        home_country: null,
        about: null,
      });

      expect(next.about_me).toBeNull();
    });
  });

  describe('updateMovementProfile', () => {
    const existing: UserSettingsData = {
      plan: 'explorer',
      ai_enabled: true,
      can_curate: false,
      movement_profile: { available_modes: ['walking', 'transit'], reach: 'normal', source: 'default' },
      about_me: null,
    };

    beforeEach(() => {
      repo.findByUserId.mockResolvedValue(rowWith(existing));
      repo.update.mockImplementation((_userId: string, settings: UserSettingsData) =>
        Promise.resolve(rowWith(settings)),
      );
    });

    it("marks a written profile source: 'user' so kebi honours the modes (kebi ADR-155)", async () => {
      const next = await service.updateMovementProfile('user_1', {
        available_modes: ['driving', 'rideshare'],
        reach: 'far',
      });

      expect(next.movement_profile).toEqual({
        available_modes: ['driving', 'rideshare'],
        reach: 'far',
        source: 'user',
      });
    });

    it('keeps the existing reach when the write carries only modes', async () => {
      const next = await service.updateMovementProfile('user_1', { available_modes: ['driving'] });

      expect(next.movement_profile?.reach).toBe('normal');
    });

    it('falls back to the config-seeded reach when there is no profile yet', async () => {
      repo.findByUserId.mockResolvedValue(rowWith({ ...existing, movement_profile: null }));

      const next = await service.updateMovementProfile('user_1', { available_modes: ['driving'] });

      expect(next.movement_profile?.reach).toBe(MOVEMENT.reach);
    });
  });

  it('re-reads the winner when the create loses the unique-constraint race', async () => {
    const winner: UserSettingsData = {
      plan: 'homebody',
      ai_enabled: true,
      can_curate: false,
      movement_profile: null,
      about_me: null,
    };
    repo.findByUserId
      .mockResolvedValueOnce(null) // initial lookup
      .mockResolvedValueOnce(rowWith(winner)); // post-conflict re-read
    repo.create.mockRejectedValue(new Error('duplicate key'));

    const settings = await service.ensureForUser('user_1');

    expect(settings).toEqual(winner);
  });
});
