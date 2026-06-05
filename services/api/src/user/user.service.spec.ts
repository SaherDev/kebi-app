import type { IAiServiceClient } from '../ai-service/ai-service-client.interface';
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
});
