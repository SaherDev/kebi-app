import type { ExtractPlaceResponse } from '@kebi-app/shared';
import type { IAiServiceClient } from '../ai-service/ai-service-client.interface';
import { ExtractRequestDto } from './dto/extract-request.dto';
import { ExtractService } from './extract.service';

describe('ExtractService', () => {
  let service: ExtractService;
  let aiClient: jest.Mocked<IAiServiceClient>;

  beforeEach(() => {
    aiClient = {
      chatStream: jest.fn(),
      postSignal: jest.fn(),
      extractPlace: jest.fn(),
      deleteUserData: jest.fn(),
    };
    service = new ExtractService(aiClient);
  });

  it('forwards raw_input and the verified user id (header) to the AI client', async () => {
    const response: ExtractPlaceResponse = {
      status: 'completed',
      results: [],
      raw_input: 'https://www.tiktok.com/@user/video/123',
      request_id: '9f1c',
      failure_reason: null,
      failure_message: null,
    };
    aiClient.extractPlace.mockResolvedValueOnce(response);

    const dto: ExtractRequestDto = {
      raw_input: 'https://www.tiktok.com/@user/video/123',
    };

    const result = await service.extract('user_clerk_123', dto);

    expect(aiClient.extractPlace).toHaveBeenCalledWith(
      { raw_input: 'https://www.tiktok.com/@user/video/123' },
      'user_clerk_123'
    );
    expect(result).toEqual(response);
  });

  it('propagates upstream errors to the caller', async () => {
    const err = new Error('kebi pipeline error');
    aiClient.extractPlace.mockRejectedValueOnce(err);

    await expect(
      service.extract('user_clerk_123', { raw_input: 'a place' })
    ).rejects.toBe(err);
  });
});
