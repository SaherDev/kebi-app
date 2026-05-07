import type { AiUserContext, AuthUser } from '@kebi-app/shared';
import { IAiServiceClient } from '../ai-service/ai-service-client.interface';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let aiClient: jest.Mocked<IAiServiceClient>;

  beforeEach(() => {
    aiClient = {
      chatStream: jest.fn(),
      postSignal: jest.fn(),
      getUserContext: jest.fn(),
      deleteUserData: jest.fn(),
    };
    service = new UserService(aiClient);
  });

  describe('getContext', () => {
    it('forwards the Clerk user id and merges plan into the AI response', async () => {
      const body: AiUserContext = {
        saved_places_count: 4,
        signal_tier: 'active',
        chips: [
          {
            label: 'Japanese',
            source_field: 'subcategory',
            source_value: 'japanese',
            signal_count: 2,
            status: 'confirmed',
            selection_round: null,
          },
        ],
      };
      aiClient.getUserContext.mockResolvedValueOnce(body);
      const user: AuthUser = { id: 'user_clerk_123', ai_enabled: true, plan: 'local_legend' };

      const result = await service.getContext(user);

      expect(aiClient.getUserContext).toHaveBeenCalledWith('user_clerk_123');
      expect(result).toEqual({ ...body, plan: 'local_legend' });
    });

    it('returns plan=null when the user has no plan set', async () => {
      const body: AiUserContext = {
        saved_places_count: 0,
        signal_tier: 'cold',
        chips: [],
      };
      aiClient.getUserContext.mockResolvedValueOnce(body);
      const user: AuthUser = { id: 'user_new', ai_enabled: true };

      const result = await service.getContext(user);

      expect(result).toEqual({ ...body, plan: null });
    });
  });

  describe('deleteData', () => {
    it('forwards the user id to the AI client with no scopes by default', async () => {
      aiClient.deleteUserData.mockResolvedValueOnce(undefined);

      await service.deleteData('user_clerk_123');

      expect(aiClient.deleteUserData).toHaveBeenCalledTimes(1);
      expect(aiClient.deleteUserData).toHaveBeenCalledWith('user_clerk_123', undefined);
    });

    it('forwards scopes when provided', async () => {
      aiClient.deleteUserData.mockResolvedValueOnce(undefined);

      await service.deleteData('user_clerk_123', ['chat_history']);

      expect(aiClient.deleteUserData).toHaveBeenCalledWith('user_clerk_123', ['chat_history']);
    });

    it('propagates upstream errors to the caller', async () => {
      const err = new Error('upstream 500');
      aiClient.deleteUserData.mockRejectedValueOnce(err);

      await expect(service.deleteData('user_clerk_123')).rejects.toBe(err);
    });
  });
});
