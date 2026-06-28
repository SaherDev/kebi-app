import type { HomeResponse } from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import type { HomeQueryDto } from './dto/home-query.dto';
import { HomeService } from './home.service';

const USER_ID = 'user_test_123';

describe('HomeService', () => {
  let service: HomeService;
  let kebi: jest.Mocked<KebiHttpClient>;

  beforeEach(() => {
    kebi = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<KebiHttpClient>;
    service = new HomeService(kebi);
  });

  describe('getHome', () => {
    const response: HomeResponse = {
      greeting: 'it’s late, drunk food?',
      chips: [{ text: 'ramen, no line' }],
    };

    it('serializes the context params and forwards the user id (header)', async () => {
      (kebi.get as jest.Mock).mockResolvedValueOnce(response);
      const query: HomeQueryDto = {
        city: 'shimokitazawa',
        local_time: '2026-06-28T21:41:00',
        weather: 'clear',
      };

      const result = await service.getHome(USER_ID, query);

      expect(kebi.get).toHaveBeenCalledWith(
        '/v1/home?city=shimokitazawa&local_time=2026-06-28T21%3A41%3A00&weather=clear',
        USER_ID
      );
      expect(result).toBe(response);
    });

    it('stringifies numeric lat/lng', async () => {
      (kebi.get as jest.Mock).mockResolvedValueOnce(response);

      await service.getHome(USER_ID, { lat: 35.6615, lng: 139.668 });

      expect(kebi.get).toHaveBeenCalledWith(
        '/v1/home?lat=35.6615&lng=139.668',
        USER_ID
      );
    });

    it('GETs with no query string for a bare query', async () => {
      (kebi.get as jest.Mock).mockResolvedValueOnce(response);

      await service.getHome(USER_ID, {});

      expect(kebi.get).toHaveBeenCalledWith('/v1/home', USER_ID);
    });
  });
});
