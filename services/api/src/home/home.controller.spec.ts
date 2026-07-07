import type { AuthUser, HomeResponse } from '@kebi-app/shared';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import type { HomeQueryDto } from './dto/home-query.dto';

describe('HomeController', () => {
  let controller: HomeController;
  let service: jest.Mocked<HomeService>;
  const user: AuthUser = { id: 'user_test_123', ai_enabled: true };

  beforeEach(() => {
    service = {
      getHome: jest.fn(),
    } as unknown as jest.Mocked<HomeService>;
    controller = new HomeController(service);
  });

  describe('GET /home', () => {
    it('forwards the verified user id and validated query to the service', async () => {
      const response: HomeResponse = { greeting: 'hi', chips: [] };
      service.getHome.mockResolvedValueOnce(response);
      const query: HomeQueryDto = { city: 'shimokitazawa' };

      const result = await controller.getHome(user, query);

      expect(service.getHome).toHaveBeenCalledTimes(1);
      expect(service.getHome).toHaveBeenCalledWith('user_test_123', query);
      expect(result).toBe(response);
    });
  });
});
