import 'reflect-metadata';
import { NormalizedIdentity, UserSettingsData } from '@kebi-app/shared';
import { AuthService } from './auth.service';
import { IdentityProvider } from './identity-provider.interface';
import { IdentityMetadataWriter } from './identity-metadata.writer';
import { ProfileWriter } from './profile-writer.interface';
import { UserIdentityService } from './user-identity.service';
import { UserSettingsService } from './user-settings.service';

const DEFAULT_SETTINGS: UserSettingsData = {
  plan: 'homebody',
  ai_enabled: true,
  movement_profile: null,
};

describe('AuthService.provision', () => {
  let service: AuthService;
  let provider: IdentityProvider;
  let metadataWriter: { stamp: jest.Mock };
  let profileWriter: { setName: jest.Mock };
  let userIdentity: { resolve: jest.Mock };
  let userSettings: { ensureForUser: jest.Mock };

  function setup(settings: UserSettingsData = DEFAULT_SETTINGS) {
    provider = { name: 'supabase', verify: jest.fn() };
    metadataWriter = { stamp: jest.fn().mockResolvedValue(undefined) };
    profileWriter = { setName: jest.fn().mockResolvedValue(undefined) };
    userIdentity = { resolve: jest.fn().mockResolvedValue('user_internal_1') };
    userSettings = { ensureForUser: jest.fn().mockResolvedValue(settings) };
    service = new AuthService(
      provider,
      metadataWriter as unknown as IdentityMetadataWriter,
      profileWriter as unknown as ProfileWriter,
      userIdentity as unknown as UserIdentityService,
      userSettings as unknown as UserSettingsService,
    );
  }

  it('ensures the user + settings and stamps the token from settings when claims are absent', async () => {
    setup();
    const identity: NormalizedIdentity = { externalId: 'ext_1', claims: {} };

    await service.provision(identity);

    expect(userIdentity.resolve).toHaveBeenCalledWith('supabase', identity);
    expect(userSettings.ensureForUser).toHaveBeenCalledWith('user_internal_1');
    expect(metadataWriter.stamp).toHaveBeenCalledWith('ext_1', {
      internal_id: 'user_internal_1',
      ai_enabled: true,
      plan: 'homebody',
    });
  });

  it('skips the stamp when the token already matches the settings', async () => {
    setup();

    await service.provision({
      externalId: 'ext_1',
      claims: { internal_id: 'user_internal_1', plan: 'homebody', ai_enabled: true },
    });

    expect(userSettings.ensureForUser).toHaveBeenCalled(); // row is still ensured
    expect(metadataWriter.stamp).not.toHaveBeenCalled(); // already in sync → no write
  });

  it('re-stamps when settings differ from the token (plan changed)', async () => {
    setup({ ...DEFAULT_SETTINGS, plan: 'explorer' });

    await service.provision({
      externalId: 'ext_1',
      claims: { internal_id: 'user_internal_1', plan: 'homebody', ai_enabled: true },
    });

    expect(metadataWriter.stamp).toHaveBeenCalledWith(
      'ext_1',
      expect.objectContaining({ plan: 'explorer' }),
    );
  });

  it('includes movement_profile in the stamp when settings carry one', async () => {
    const movement_profile = { available_modes: ['walking' as const], reach: 'far' as const };
    setup({ ...DEFAULT_SETTINGS, movement_profile });

    await service.provision({ externalId: 'ext_1', claims: {} });

    expect(metadataWriter.stamp).toHaveBeenCalledWith(
      'ext_1',
      expect.objectContaining({ movement_profile }),
    );
  });

  describe('name seed', () => {
    it('seeds the name from the email local-part when name is absent', async () => {
      setup();

      await service.provision({
        externalId: 'ext_1',
        claims: {},
        email: 'saher@kebi.app',
      });

      expect(profileWriter.setName).toHaveBeenCalledWith('ext_1', 'saher');
    });

    it('does not overwrite an existing name (e.g. Google full_name)', async () => {
      setup();

      await service.provision({
        externalId: 'ext_1',
        claims: {},
        email: 'saher@kebi.app',
        name: 'Saher Q',
      });

      expect(profileWriter.setName).not.toHaveBeenCalled();
    });

    it('seeds nothing when neither name nor email exist (phone signup)', async () => {
      setup();

      await service.provision({ externalId: 'ext_1', claims: {} });

      expect(profileWriter.setName).not.toHaveBeenCalled();
    });

    it('fails open — a seed write error does not break provisioning', async () => {
      setup();
      profileWriter.setName.mockRejectedValue(new Error('admin down'));

      await expect(
        service.provision({
          externalId: 'ext_1',
          claims: {},
          email: 'saher@kebi.app',
        }),
      ).resolves.toBeUndefined();
    });
  });
});
