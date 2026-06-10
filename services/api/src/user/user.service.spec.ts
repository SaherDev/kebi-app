import type { LibraryResponse, LibraryUserData } from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import type { LibraryQueryDto } from './dto/library-query.dto';
import type { UpdateUserPlaceDto } from './dto/update-user-place.dto';
import { UserService } from './user.service';

const USER_ID = 'user_test_123';

describe('UserService', () => {
  let service: UserService;
  let kebi: jest.Mocked<KebiHttpClient>;

  beforeEach(() => {
    kebi = {
      get: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<KebiHttpClient>;
    service = new UserService(kebi);
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
