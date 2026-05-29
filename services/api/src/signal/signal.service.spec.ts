import type { SignalResponse } from '@kebi-app/shared';
import type { IAiServiceClient } from '../ai-service/ai-service-client.interface';
import { SignalRequestDto } from './dto/signal-request.dto';
import { SignalService } from './signal.service';

describe('SignalService', () => {
  let service: SignalService;
  let aiClient: jest.Mocked<IAiServiceClient>;

  beforeEach(() => {
    aiClient = {
      chatStream: jest.fn(),
      postSignal: jest.fn(),
      extractPlace: jest.fn(),
      deleteUserData: jest.fn(),
    };
    service = new SignalService(aiClient);
  });

  it('forwards an accepted signal with the verified user id as the second arg (header), never the body', async () => {
    const body: SignalResponse = { status: 'accepted' };
    aiClient.postSignal.mockResolvedValueOnce(body);

    const dto: SignalRequestDto = {
      signal_type: 'recommendation_accepted',
      recommendation_id: 'rec_1',
      place_core_id: 'c0ffee00-1111-2222-3333-444455556666',
    };

    const result = await service.submit('user_clerk_123', dto);

    expect(aiClient.postSignal).toHaveBeenCalledWith(
      {
        signal_type: 'recommendation_accepted',
        recommendation_id: 'rec_1',
        place_core_id: 'c0ffee00-1111-2222-3333-444455556666',
      },
      'user_clerk_123'
    );
    expect(result).toEqual(body);
  });

  it('forwards rejected signals the same way', async () => {
    aiClient.postSignal.mockResolvedValueOnce({ status: 'accepted' });

    const dto: SignalRequestDto = {
      signal_type: 'recommendation_rejected',
      recommendation_id: 'rec_2',
      place_core_id: 'c0ffee00-2222-3333-4444-555566667777',
    };

    await service.submit('user_clerk_456', dto);

    expect(aiClient.postSignal).toHaveBeenCalledWith(
      expect.objectContaining({ signal_type: 'recommendation_rejected' }),
      'user_clerk_456'
    );
  });

  it('propagates upstream errors so the global filter can translate them', async () => {
    const upstream = new Error('kebi error');
    aiClient.postSignal.mockRejectedValueOnce(upstream);

    await expect(
      service.submit('user_clerk_123', {
        signal_type: 'recommendation_accepted',
        recommendation_id: 'bogus',
        place_core_id: 'c0ffee00-9999-0000-1111-222233334444',
      })
    ).rejects.toBe(upstream);
  });
});
