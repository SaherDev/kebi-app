import type { AuthUser } from '@kebi-app/shared';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { DeleteUserDataQueryDto } from './dto/delete-user-data.query.dto';

describe('UserController', () => {
  let controller: UserController;
  let service: jest.Mocked<UserService>;

  beforeEach(() => {
    service = {
      deleteData: jest.fn(),
    } as unknown as jest.Mocked<UserService>;
    controller = new UserController(service);
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
