import type {
  AuthUser,
  IntentsResponse,
  LibraryResponse,
  LibraryUserData,
  NormalizedIdentity,
  UserProfile,
} from '@kebi-app/shared';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { DeleteUserDataQueryDto } from './dto/delete-user-data.query.dto';
import type { IntentsQueryDto } from './dto/intents-query.dto';
import type { LibraryQueryDto } from './dto/library-query.dto';
import type { SaveUserPlaceDto } from './dto/save-user-place.dto';
import type { UpdateUserPlaceDto } from './dto/update-user-place.dto';

describe('UserController', () => {
  let controller: UserController;
  let service: jest.Mocked<UserService>;
  const user: AuthUser = { id: 'user_test_123', ai_enabled: true, plan: 'explorer' };

  beforeEach(() => {
    service = {
      deleteData: jest.fn(),
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      changePlan: jest.fn(),
      getLibrary: jest.fn(),
      getIntents: jest.fn(),
      savePlace: jest.fn(),
      updatePlace: jest.fn(),
      deletePlace: jest.fn(),
    } as unknown as jest.Mocked<UserService>;
    controller = new UserController(service);
  });

  describe('GET /user/profile', () => {
    const identity: NormalizedIdentity = {
      externalId: 'ext_1',
      claims: {},
      email: 'saher@kebi.app',
      name: 'saher',
    };

    it('returns the profile from identity + user', () => {
      const profile: UserProfile = { name: 'saher', email: 'saher@kebi.app', plan: 'explorer' };
      service.getProfile.mockReturnValueOnce(profile);

      const result = controller.getProfile(identity, user);

      expect(service.getProfile).toHaveBeenCalledWith(identity, user);
      expect(result).toBe(profile);
    });
  });

  describe('PATCH /user/profile', () => {
    const identity: NormalizedIdentity = {
      externalId: 'ext_1',
      claims: {},
      email: 'saher@kebi.app',
      name: 'old',
    };

    it('forwards identity, user, and the validated name to the service', async () => {
      const profile: UserProfile = { name: 'new', email: 'saher@kebi.app', plan: 'explorer' };
      service.updateProfile.mockResolvedValueOnce(profile);

      const result = await controller.updateProfile(identity, user, { name: 'new' });

      expect(service.updateProfile).toHaveBeenCalledWith(identity, user, 'new');
      expect(result).toBe(profile);
    });
  });

  describe('PATCH /user/plan', () => {
    const identity: NormalizedIdentity = {
      externalId: 'ext_1',
      claims: {},
      email: 'saher@kebi.app',
      name: 'saher',
    };

    it('forwards identity, user, and the validated plan to the service', async () => {
      const profile: UserProfile = { name: 'saher', email: 'saher@kebi.app', plan: 'explorer' };
      service.changePlan.mockResolvedValueOnce(profile);

      const result = await controller.changePlan(identity, user, { plan: 'explorer' });

      expect(service.changePlan).toHaveBeenCalledWith(identity, user, 'explorer');
      expect(result).toBe(profile);
    });
  });

  describe('GET /user/library', () => {
    it('forwards the verified user id and validated query to the service', async () => {
      const response: LibraryResponse = { places: [], next_cursor: null };
      service.getLibrary.mockResolvedValueOnce(response);
      const query: LibraryQueryDto = { sort: 'name', limit: 20 };

      const result = await controller.getLibrary(user, query);

      expect(service.getLibrary).toHaveBeenCalledTimes(1);
      expect(service.getLibrary).toHaveBeenCalledWith('user_test_123', query);
      expect(result).toBe(response);
    });
  });

  describe('GET /user/intents', () => {
    it('forwards the verified user id and validated query to the service', async () => {
      const response: IntentsResponse = { intents: [], next_cursor: null };
      service.getIntents.mockResolvedValueOnce(response);
      const query: IntentsQueryDto = { limit: 20 };

      const result = await controller.getIntents(user, query);

      expect(service.getIntents).toHaveBeenCalledTimes(1);
      expect(service.getIntents).toHaveBeenCalledWith('user_test_123', query);
      expect(result).toBe(response);
    });
  });

  describe('POST /user/places', () => {
    it('forwards the verified user id and validated body to the service', async () => {
      const saved = { user_place_id: 'up_1', place_id: 'place_1' } as LibraryUserData;
      service.savePlace.mockResolvedValueOnce(saved);
      const dto: SaveUserPlaceDto = {
        place_core_id: 'place_1',
        recommendation_id: 'rec_1',
      };

      const result = await controller.savePlace(user, dto);

      expect(service.savePlace).toHaveBeenCalledWith('user_test_123', dto, 'explorer');
      expect(result).toBe(saved);
    });
  });

  describe('PATCH /user/places/:id', () => {
    it('forwards the user id, path id, and partial body to the service', async () => {
      const updated = { user_place_id: 'up_1', visited: true } as LibraryUserData;
      service.updatePlace.mockResolvedValueOnce(updated);
      const dto: UpdateUserPlaceDto = { visited: true };

      const result = await controller.updatePlace(user, 'up_1', dto);

      expect(service.updatePlace).toHaveBeenCalledWith('user_test_123', 'up_1', dto);
      expect(result).toBe(updated);
    });
  });

  describe('DELETE /user/places/:id', () => {
    it('forwards the user id and path id and resolves void', async () => {
      service.deletePlace.mockResolvedValueOnce(undefined);

      const result = await controller.deletePlace(user, 'up_1');

      expect(service.deletePlace).toHaveBeenCalledWith('user_test_123', 'up_1');
      expect(result).toBeUndefined();
    });
  });

  describe('DELETE /user/data', () => {
    const user: AuthUser = { id: 'user_test_123', ai_enabled: true };

    it('forwards undefined scopes when the query is empty', async () => {
      service.deleteData.mockResolvedValueOnce(undefined);
      const query: DeleteUserDataQueryDto = {};

      const result = await controller.deleteData(user, query);

      expect(service.deleteData).toHaveBeenCalledTimes(1);
      expect(service.deleteData).toHaveBeenCalledWith('user_test_123', undefined);
      expect(result).toBeUndefined();
    });

    it('forwards scopes parsed by the validation pipe', async () => {
      service.deleteData.mockResolvedValueOnce(undefined);
      const query: DeleteUserDataQueryDto = { scope: ['chat_history'] };

      await controller.deleteData(user, query);

      expect(service.deleteData).toHaveBeenCalledWith('user_test_123', ['chat_history']);
    });

    it('forwards repeated scopes', async () => {
      service.deleteData.mockResolvedValueOnce(undefined);
      const query: DeleteUserDataQueryDto = { scope: ['chat_history', 'all'] };

      await controller.deleteData(user, query);

      expect(service.deleteData).toHaveBeenCalledWith('user_test_123', ['chat_history', 'all']);
    });
  });
});
