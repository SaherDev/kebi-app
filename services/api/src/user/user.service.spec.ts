import type { LibraryResponse, LibraryUserData } from '@kebi-app/shared';
import type { IAiServiceClient } from '../ai-service/ai-service-client.interface';
import type { LibraryQueryDto } from './dto/library-query.dto';
import type { UpdateUserPlaceDto } from './dto/update-user-place.dto';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let aiClient: jest.Mocked<IAiServiceClient>;

  beforeEach(() => {
    aiClient = {
      chatStream: jest.fn(),
      postSignal: jest.fn(),
      extractPlace: jest.fn(),
      deleteUserData: jest.fn(),
      getUserLibrary: jest.fn(),
      updateUserPlace: jest.fn(),
      deleteUserPlace: jest.fn(),
    };
    service = new UserService(aiClient);
  });

  describe('deleteData', () => {
    it('forwards the user id to the AI client with no scopes by default', async () => {
      aiClient.deleteUserData.mockResolvedValueOnce(undefined);

      await service.deleteData('user_test_123');

      expect(aiClient.deleteUserData).toHaveBeenCalledTimes(1);
      expect(aiClient.deleteUserData).toHaveBeenCalledWith('user_test_123', undefined);
    });

    it('forwards scopes when provided', async () => {
      aiClient.deleteUserData.mockResolvedValueOnce(undefined);

      await service.deleteData('user_test_123', ['chat_history']);

      expect(aiClient.deleteUserData).toHaveBeenCalledWith('user_test_123', ['chat_history']);
    });

    it('propagates upstream errors to the caller', async () => {
      const err = new Error('upstream 500');
      aiClient.deleteUserData.mockRejectedValueOnce(err);

      await expect(service.deleteData('user_test_123')).rejects.toBe(err);
    });
  });

  describe('getLibrary', () => {
    const response: LibraryResponse = { places: [], next_cursor: null };

    it('flattens the validated query and forwards the user id as the header arg', async () => {
      aiClient.getUserLibrary.mockResolvedValueOnce(response);
      const query: LibraryQueryDto = {
        category: ['cafe', 'bar'],
        visited: false,
        sort: 'name',
        limit: 20,
      };

      const result = await service.getLibrary('user_test_123', query);

      expect(aiClient.getUserLibrary).toHaveBeenCalledTimes(1);
      expect(aiClient.getUserLibrary).toHaveBeenCalledWith(
        {
          category: ['cafe', 'bar'],
          visited: 'false',
          sort: 'name',
          limit: '20',
        },
        'user_test_123'
      );
      expect(result).toBe(response);
    });

    it('drops omitted params and forwards an empty record for a bare query', async () => {
      aiClient.getUserLibrary.mockResolvedValueOnce(response);

      await service.getLibrary('user_test_123', {});

      expect(aiClient.getUserLibrary).toHaveBeenCalledWith({}, 'user_test_123');
    });
  });

  describe('updatePlace', () => {
    const updated = { user_place_id: 'up_1', visited: true } as LibraryUserData;

    it('forwards the path id, partial body, and user id (header)', async () => {
      aiClient.updateUserPlace.mockResolvedValueOnce(updated);
      const dto: UpdateUserPlaceDto = { visited: true };

      const result = await service.updatePlace('user_test_123', 'up_1', dto);

      expect(aiClient.updateUserPlace).toHaveBeenCalledWith('up_1', dto, 'user_test_123');
      expect(result).toBe(updated);
    });

    it('preserves an explicit null (clear) in the forwarded body', async () => {
      aiClient.updateUserPlace.mockResolvedValueOnce(updated);
      const dto: UpdateUserPlaceDto = { liked: null, note: null };

      await service.updatePlace('user_test_123', 'up_1', dto);

      expect(aiClient.updateUserPlace).toHaveBeenCalledWith(
        'up_1',
        { liked: null, note: null },
        'user_test_123'
      );
    });
  });

  describe('deletePlace', () => {
    it('forwards the path id and user id (header)', async () => {
      aiClient.deleteUserPlace.mockResolvedValueOnce(undefined);

      await service.deletePlace('user_test_123', 'up_1');

      expect(aiClient.deleteUserPlace).toHaveBeenCalledWith('up_1', 'user_test_123');
    });

    it('propagates a 404 from the AI client', async () => {
      const err = new Error('saved_place_not_found');
      aiClient.deleteUserPlace.mockRejectedValueOnce(err);

      await expect(service.deletePlace('user_test_123', 'missing')).rejects.toBe(err);
    });
  });
});
