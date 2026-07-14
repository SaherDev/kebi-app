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
  let userSettings: { updatePlan: jest.Mock };
  let metadataWriter: { stamp: jest.Mock };

  beforeEach(() => {
    kebi = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<KebiHttpClient>;
    profileWriter = { setName: jest.fn().mockResolvedValue(undefined) };
    userSettings = { updatePlan: jest.fn() };
    metadataWriter = { stamp: jest.fn().mockResolvedValue(undefined) };
    service = new UserService(
      kebi,
      profileWriter as unknown as ProfileWriter,
      userSettings as unknown as UserSettingsService,
      metadataWriter as unknown as IdentityMetadataWriter,
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

      expect(profile).toEqual({ name: 'saher', email: 'saher@kebi.app', plan: 'explorer' });
      expect(kebi.get).not.toHaveBeenCalled();
    });

    it('falls back to empty strings / homebody when identity/plan are bare', () => {
      const profile = service.getProfile(
        { externalId: 'ext_2', claims: {} },
        { id: USER_ID, ai_enabled: true },
      );

      expect(profile).toEqual({ name: '', email: '', plan: 'homebody' });
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

    it('omits movement_profile from the stamp when the user has none', async () => {
      userSettings.updatePlan.mockResolvedValueOnce({
        plan: 'local_legend',
        ai_enabled: true,
        can_curate: false,
        movement_profile: null,
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
      const dto: SaveUserPlaceDto = {
        place_core_id: 'place_1',
        recommendation_id: 'rec_1',
      };

      const result = await service.savePlace(USER_ID, dto, 'homebody');

      // plan rides along so kebi can enforce the save_limit (ADR-112).
      expect(kebi.post).toHaveBeenCalledWith(
        '/v1/user/places',
        USER_ID,
        { place_core_id: 'place_1', recommendation_id: 'rec_1' },
        'homebody'
      );
      expect(result).toBe(saved);
    });

    it('forwards the reason (consult rationale) when present', async () => {
      (kebi.post as jest.Mock).mockResolvedValueOnce(saved);
      const dto: SaveUserPlaceDto = {
        place_core_id: 'place_1',
        recommendation_id: 'rec_1',
        reason: 'great deep house',
      };

      await service.savePlace(USER_ID, dto, 'homebody');

      expect(kebi.post).toHaveBeenCalledWith(
        '/v1/user/places',
        USER_ID,
        { place_core_id: 'place_1', recommendation_id: 'rec_1', reason: 'great deep house' },
        'homebody'
      );
    });

    it('propagates a 404 (place_not_found) from the transport', async () => {
      const err = new Error('place_not_found');
      (kebi.post as jest.Mock).mockRejectedValueOnce(err);

      await expect(
        service.savePlace(USER_ID, {
          place_core_id: 'missing',
          recommendation_id: 'rec_1',
        })
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
