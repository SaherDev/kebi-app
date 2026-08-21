import type {
  AuthUser,
  IntentsResponse,
  LibraryResponse,
  LibraryUserData,
  NormalizedIdentity,
} from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import type { ProfileWriter } from '../auth/profile-writer.interface';
import type { IdentityMetadataWriter } from '../auth/identity-metadata.writer';
import type { IdentityProvider } from '../auth/identity-provider.interface';
import { ClaimStamper } from '../auth/claim-stamper';
import type { UserIdentityService } from '../auth/user-identity.service';
import type { UserSettingsService } from '../auth/user-settings.service';
import type { IntentsQueryDto } from './dto/intents-query.dto';
import type { LibraryQueryDto } from './dto/library-query.dto';
import type { SaveUserPlaceDto } from './dto/save-user-place.dto';
import type { UpdateUserPlaceDto } from './dto/update-user-place.dto';
import { UserService } from './user.service';

const USER_ID = 'user_test_123';

describe('UserService', () => {
  let service: UserService;
  let kebi: jest.Mocked<KebiHttpClient>;
  let profileWriter: { setName: jest.Mock };
  let userSettings: {
    ensureForUser: jest.Mock;
    updatePlan: jest.Mock;
    updateAboutMe: jest.Mock;
    updateMovementProfile: jest.Mock;
  };
  let metadataWriter: { stamp: jest.Mock };
  let userIdentity: { resolve: jest.Mock; lookup: jest.Mock };

  beforeEach(() => {
    kebi = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<KebiHttpClient>;
    profileWriter = { setName: jest.fn().mockResolvedValue(undefined) };
    userSettings = {
      ensureForUser: jest.fn(),
      updatePlan: jest.fn(),
      updateAboutMe: jest.fn(),
      updateMovementProfile: jest.fn(),
    };
    metadataWriter = { stamp: jest.fn().mockResolvedValue(undefined) };
    // Steady state: the mapping owns the same id the token claims.
    userIdentity = {
      resolve: jest.fn().mockResolvedValue(USER_ID),
      lookup: jest.fn().mockResolvedValue(USER_ID),
    };
    const provider = { name: 'supabase', verify: jest.fn() } as IdentityProvider;
    service = new UserService(
      kebi,
      profileWriter as unknown as ProfileWriter,
      provider,
      userIdentity as unknown as UserIdentityService,
      userSettings as unknown as UserSettingsService,
      new ClaimStamper(
        metadataWriter as unknown as IdentityMetadataWriter,
        provider,
        userIdentity as unknown as UserIdentityService,
      ),
    );
  });

  describe('getProfile', () => {
    const identity: NormalizedIdentity = {
      externalId: 'ext_1',
      claims: {},
      email: 'saher@kebi.app',
      name: 'saher',
    };
    const user: AuthUser = { id: USER_ID, ai_enabled: true, plan: 'explorer' };

    it('returns name/email from the identity and plan from the user claim (no kebi call)', () => {
      const profile = service.getProfile(identity, user);

      expect(profile).toEqual({
        name: 'saher',
        email: 'saher@kebi.app',
        plan: 'explorer',
        can_curate: false,
      });
      expect(kebi.get).not.toHaveBeenCalled();
    });

    it('surfaces the curator role so the client can render the insider surfaces', () => {
      const profile = service.getProfile(identity, { ...user, can_curate: true });

      expect(profile.can_curate).toBe(true);
    });

    it('falls back to empty strings / homebody / not-a-curator when the claims are bare', () => {
      const profile = service.getProfile(
        { externalId: 'ext_2', claims: {} },
        { id: USER_ID, ai_enabled: true },
      );

      // Absent can_curate reads as false, matching CuratorGuard's fail-closed
      // read — a pre-grant token renders the non-insider surface.
      expect(profile).toEqual({ name: '', email: '', plan: 'homebody', can_curate: false });
    });
  });

  describe('updateProfile', () => {
    const identity: NormalizedIdentity = {
      externalId: 'ext_1',
      claims: {},
      email: 'saher@kebi.app',
      name: 'old name',
    };
    const user: AuthUser = { id: USER_ID, ai_enabled: true, plan: 'local_legend' };

    it('writes the new name and echoes it (not the stale identity name)', async () => {
      const profile = await service.updateProfile(identity, user, 'new name');

      expect(profileWriter.setName).toHaveBeenCalledWith('ext_1', 'new name');
      expect(profile).toEqual({
        name: 'new name',
        email: 'saher@kebi.app',
        plan: 'local_legend',
      });
    });

    it('propagates a writer failure so the client can surface it', async () => {
      profileWriter.setName.mockRejectedValueOnce(new Error('admin down'));

      await expect(service.updateProfile(identity, user, 'x')).rejects.toThrow('admin down');
    });
  });

  describe('changePlan', () => {
    const identity: NormalizedIdentity = {
      externalId: 'ext_1',
      claims: {},
      email: 'saher@kebi.app',
      name: 'saher',
    };
    const user: AuthUser = { id: USER_ID, ai_enabled: true, plan: 'homebody' };

    it('writes the plan, re-stamps the token claims, and echoes the new plan', async () => {
      userSettings.updatePlan.mockResolvedValueOnce({
        plan: 'explorer',
        ai_enabled: true,
        can_curate: false,
        movement_profile: { available_modes: ['walking'], reach: 'normal' },
        about_me: null,
      });

      const profile = await service.changePlan(identity, user, 'explorer');

      expect(userSettings.updatePlan).toHaveBeenCalledWith(USER_ID, 'explorer');
      // Re-stamp uses the externalId + the fresh settings (internal id from the user).
      expect(metadataWriter.stamp).toHaveBeenCalledWith('ext_1', {
        internal_id: USER_ID,
        ai_enabled: true,
        plan: 'explorer',
        can_curate: false,
        movement_profile: { available_modes: ['walking'], reach: 'normal' },
      });
      expect(profile).toEqual({ name: 'saher', email: 'saher@kebi.app', plan: 'explorer' });
    });

    it('writes and stamps the MAPPED id when the token claims a different one (corrupted-token safety)', async () => {
      // The production incident: a token carrying a stale test id would write
      // the wrong settings row and copy the bad id back onto the account.
      userIdentity.lookup.mockResolvedValue('user_real');
      userSettings.updatePlan.mockResolvedValueOnce({
        plan: 'explorer',
        ai_enabled: true,
        can_curate: false,
        movement_profile: null,
        about_me: null,
      });

      await service.changePlan(identity, { ...user, id: 'user_stale_bad' }, 'explorer');

      expect(userSettings.updatePlan).toHaveBeenCalledWith('user_real', 'explorer');
      expect(metadataWriter.stamp).toHaveBeenCalledWith(
        'ext_1',
        expect.objectContaining({ internal_id: 'user_real' }),
      );
    });

    it('falls back to the token id and skips the stamp when no mapping exists (dev bypass)', async () => {
      userIdentity.lookup.mockResolvedValue(null);
      userSettings.updatePlan.mockResolvedValueOnce({
        plan: 'explorer',
        ai_enabled: true,
        can_curate: false,
        movement_profile: null,
        about_me: null,
      });

      await service.changePlan(identity, user, 'explorer');

      expect(userSettings.updatePlan).toHaveBeenCalledWith(USER_ID, 'explorer');
      // No mapping → no real account behind the identity → nothing to stamp.
      expect(metadataWriter.stamp).not.toHaveBeenCalled();
    });

    it('omits movement_profile from the stamp when the user has none', async () => {
      userSettings.updatePlan.mockResolvedValueOnce({
        plan: 'local_legend',
        ai_enabled: true,
        can_curate: false,
        movement_profile: null,
        about_me: null,
      });

      await service.changePlan(identity, user, 'local_legend');

      expect(metadataWriter.stamp).toHaveBeenCalledWith('ext_1', {
        internal_id: USER_ID,
        ai_enabled: true,
        plan: 'local_legend',
        can_curate: false,
      });
    });
  });

  describe('getSettings', () => {
    it('reads the settings row, not the token claims — a fresh write is visible at once', async () => {
      const about_me = { call_me: 'Saher', home_country: 'AE', about: null };
      const movement_profile = {
        available_modes: ['driving' as const],
        reach: 'far' as const,
        source: 'user' as const,
      };
      userSettings.ensureForUser.mockResolvedValueOnce({
        plan: 'homebody',
        ai_enabled: true,
        can_curate: false,
        movement_profile,
        about_me,
      });

      const result = await service.getSettings(USER_ID);

      expect(userSettings.ensureForUser).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({ about_me, movement_profile });
      expect(kebi.get).not.toHaveBeenCalled();
    });

    it('returns nulls for a user who has set neither', async () => {
      userSettings.ensureForUser.mockResolvedValueOnce({
        plan: 'homebody',
        ai_enabled: true,
        can_curate: false,
        movement_profile: null,
        about_me: null,
      });

      expect(await service.getSettings(USER_ID)).toEqual({
        about_me: null,
        movement_profile: null,
      });
    });
  });

  describe('updateAboutMe', () => {
    const identity: NormalizedIdentity = {
      externalId: 'ext_1',
      claims: {},
      email: 'saher@kebi.app',
      name: 'saher',
    };
    const user: AuthUser = { id: USER_ID, ai_enabled: true, plan: 'homebody' };

    it('writes the block and re-stamps it into the claims (kebi ADR-154)', async () => {
      const about_me = { call_me: 'Saher', home_country: 'AE', about: 'I do not drink.' };
      userSettings.updateAboutMe.mockResolvedValueOnce({
        plan: 'homebody',
        ai_enabled: true,
        can_curate: false,
        movement_profile: null,
        about_me,
      });

      const result = await service.updateAboutMe(identity, user, about_me);

      expect(userSettings.updateAboutMe).toHaveBeenCalledWith(USER_ID, about_me);
      expect(metadataWriter.stamp).toHaveBeenCalledWith(
        'ext_1',
        expect.objectContaining({ about_me }),
      );
      expect(result).toEqual(about_me);
    });

    it('echoes an empty block when the write cleared everything', async () => {
      userSettings.updateAboutMe.mockResolvedValueOnce({
        plan: 'homebody',
        ai_enabled: true,
        can_curate: false,
        movement_profile: null,
        about_me: null,
      });

      const result = await service.updateAboutMe(identity, user, {});

      expect(result).toEqual({ call_me: null, home_country: null, about: null });
      // Nothing to say about the user → the claim is omitted, not stamped null.
      expect(metadataWriter.stamp).toHaveBeenCalledWith(
        'ext_1',
        expect.not.objectContaining({ about_me: expect.anything() }),
      );
    });
  });

  describe('updateMovementProfile', () => {
    const identity: NormalizedIdentity = { externalId: 'ext_1', claims: {} };
    const user: AuthUser = { id: USER_ID, ai_enabled: true, plan: 'homebody' };

    it("writes the modes and re-stamps the source: 'user' profile", async () => {
      const movement_profile = {
        available_modes: ['driving' as const],
        reach: 'far' as const,
        source: 'user' as const,
      };
      userSettings.updateMovementProfile.mockResolvedValueOnce({
        plan: 'homebody',
        ai_enabled: true,
        can_curate: false,
        movement_profile,
        about_me: null,
      });

      const result = await service.updateMovementProfile(identity, user, {
        available_modes: ['driving'],
        reach: 'far',
      });

      expect(result).toEqual(movement_profile);
      expect(metadataWriter.stamp).toHaveBeenCalledWith(
        'ext_1',
        expect.objectContaining({ movement_profile }),
      );
    });
  });

  describe('getLibrary', () => {
    const response: LibraryResponse = { places: [], next_cursor: null };

    it('serializes scalars and repeats array params (category/tag), dropping omitted ones', async () => {
      (kebi.get as jest.Mock).mockResolvedValueOnce(response);
      const query: LibraryQueryDto = {
        category: ['cafe', 'bar'],
        visited: false,
        sort: 'name',
        limit: 20,
      };

      const result = await service.getLibrary(USER_ID, query);

      expect(kebi.get).toHaveBeenCalledWith(
        '/v1/user/library?category=cafe&category=bar&visited=false&sort=name&limit=20',
        USER_ID
      );
      expect(result).toBe(response);
    });

    it('GETs with no query string for a bare query', async () => {
      (kebi.get as jest.Mock).mockResolvedValueOnce(response);

      await service.getLibrary(USER_ID, {});

      expect(kebi.get).toHaveBeenCalledWith('/v1/user/library', USER_ID);
    });

    it('forwards q and area, url-encoding the geo key (ADR-164, ADR-165)', async () => {
      (kebi.get as jest.Mock).mockResolvedValueOnce(response);

      await service.getLibrary(USER_ID, { q: 'canggu coffee', area: 'id/bali/canggu' });

      expect(kebi.get).toHaveBeenCalledWith(
        '/v1/user/library?q=canggu+coffee&area=id%2Fbali%2Fcanggu',
        USER_ID
      );
    });
  });

  describe('getLibraryAreas', () => {
    it('GETs the distribution with identity only — it takes no params', async () => {
      const areas = { areas: [] };
      (kebi.get as jest.Mock).mockResolvedValueOnce(areas);

      const result = await service.getLibraryAreas(USER_ID);

      expect(kebi.get).toHaveBeenCalledWith('/v1/user/library/areas', USER_ID);
      expect(result).toBe(areas);
    });
  });

  describe('getIntents', () => {
    const response: IntentsResponse = { intents: [], next_cursor: null };

    it('serializes limit/cursor and forwards the user id (header)', async () => {
      (kebi.get as jest.Mock).mockResolvedValueOnce(response);
      const query: IntentsQueryDto = { limit: 20, cursor: 'eyJ0cyI6' };

      const result = await service.getIntents(USER_ID, query);

      expect(kebi.get).toHaveBeenCalledWith(
        '/v1/user/intents?limit=20&cursor=eyJ0cyI6',
        USER_ID
      );
      expect(result).toBe(response);
    });

    it('GETs with no query string for a bare query', async () => {
      (kebi.get as jest.Mock).mockResolvedValueOnce(response);

      await service.getIntents(USER_ID, {});

      expect(kebi.get).toHaveBeenCalledWith('/v1/user/intents', USER_ID);
    });
  });

  describe('savePlace', () => {
    const saved = { user_place_id: 'up_1', place_id: 'place_1' } as LibraryUserData;

    it('POSTs /v1/user/places with the body and user id (header)', async () => {
      (kebi.post as jest.Mock).mockResolvedValueOnce(saved);
      const dto: SaveUserPlaceDto = { place_core_id: 'place_1' };

      const result = await service.savePlace(USER_ID, dto, 'homebody');

      // plan rides along so kebi can enforce the save_limit (ADR-112).
      expect(kebi.post).toHaveBeenCalledWith(
        '/v1/user/places',
        USER_ID,
        { place_core_id: 'place_1' },
        'homebody'
      );
      expect(result).toBe(saved);
    });

    it('sends the place id alone — the retired card fields are never forwarded', async () => {
      (kebi.post as jest.Mock).mockResolvedValueOnce(saved);
      // A stale client could still hand these in; kebi 422s on unknown keys
      // (ADR-151), so the gateway must not pass them through.
      const stale = {
        place_core_id: 'place_1',
        recommendation_id: 'rec_1',
        reason: 'great deep house',
      } as SaveUserPlaceDto;

      await service.savePlace(USER_ID, stale, 'homebody');

      expect(kebi.post).toHaveBeenCalledWith(
        '/v1/user/places',
        USER_ID,
        { place_core_id: 'place_1' },
        'homebody'
      );
    });

    it('propagates a 404 (place_not_found) from the transport', async () => {
      const err = new Error('place_not_found');
      (kebi.post as jest.Mock).mockRejectedValueOnce(err);

      await expect(
        service.savePlace(USER_ID, { place_core_id: 'missing' })
      ).rejects.toBe(err);
    });
  });

  describe('updatePlace', () => {
    const updated = { user_place_id: 'up_1', visited: true } as LibraryUserData;

    it('PATCHes /v1/user/places/{id} with the partial body and user id (header)', async () => {
      (kebi.patch as jest.Mock).mockResolvedValueOnce(updated);
      const dto: UpdateUserPlaceDto = { visited: true };

      const result = await service.updatePlace(USER_ID, 'up_1', dto);

      expect(kebi.patch).toHaveBeenCalledWith(
        '/v1/user/places/up_1',
        USER_ID,
        { visited: true }
      );
      expect(result).toBe(updated);
    });

    it('preserves an explicit null (clear) in the forwarded body', async () => {
      (kebi.patch as jest.Mock).mockResolvedValueOnce(updated);
      const dto: UpdateUserPlaceDto = { liked: null, note: null };

      await service.updatePlace(USER_ID, 'up_1', dto);

      expect(kebi.patch).toHaveBeenCalledWith(
        '/v1/user/places/up_1',
        USER_ID,
        { liked: null, note: null }
      );
    });

    it('url-encodes the path id', async () => {
      (kebi.patch as jest.Mock).mockResolvedValueOnce(updated);

      await service.updatePlace(USER_ID, 'a/b 1', { visited: true });

      expect(kebi.patch).toHaveBeenCalledWith(
        '/v1/user/places/a%2Fb%201',
        USER_ID,
        { visited: true }
      );
    });
  });

  describe('deletePlace', () => {
    it('DELETEs /v1/user/places/{id} with the user id (header)', async () => {
      (kebi.delete as jest.Mock).mockResolvedValueOnce(undefined);

      await service.deletePlace(USER_ID, 'up_1');

      expect(kebi.delete).toHaveBeenCalledWith('/v1/user/places/up_1', USER_ID);
    });

    it('propagates a 404 from the transport', async () => {
      const err = new Error('saved_place_not_found');
      (kebi.delete as jest.Mock).mockRejectedValueOnce(err);

      await expect(service.deletePlace(USER_ID, 'missing')).rejects.toBe(err);
    });
  });

  describe('deleteData', () => {
    it('DELETEs /v1/user/data with no query string when scopes is omitted or empty', async () => {
      (kebi.delete as jest.Mock).mockResolvedValue(undefined);

      await service.deleteData(USER_ID);
      await service.deleteData(USER_ID, []);

      expect(kebi.delete).toHaveBeenNthCalledWith(1, '/v1/user/data', USER_ID);
      expect(kebi.delete).toHaveBeenNthCalledWith(2, '/v1/user/data', USER_ID);
    });

    it('serializes a single scope as ?scope=value', async () => {
      (kebi.delete as jest.Mock).mockResolvedValueOnce(undefined);

      await service.deleteData(USER_ID, ['chat_history']);

      expect(kebi.delete).toHaveBeenCalledWith(
        '/v1/user/data?scope=chat_history',
        USER_ID
      );
    });

    it('serializes multiple scopes as repeated ?scope= params', async () => {
      (kebi.delete as jest.Mock).mockResolvedValueOnce(undefined);

      await service.deleteData(USER_ID, ['chat_history', 'all']);

      expect(kebi.delete).toHaveBeenCalledWith(
        '/v1/user/data?scope=chat_history&scope=all',
        USER_ID
      );
    });

    it('propagates upstream errors to the caller', async () => {
      const err = new Error('upstream 500');
      (kebi.delete as jest.Mock).mockRejectedValueOnce(err);

      await expect(service.deleteData(USER_ID)).rejects.toBe(err);
    });
  });
});
