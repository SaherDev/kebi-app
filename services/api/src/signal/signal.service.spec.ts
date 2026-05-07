import type { SignalResponse } from '@kebi-app/shared';
import { IAiServiceClient } from '../ai-service/ai-service-client.interface';
import { SignalRequestDto } from './dto/signal-request.dto';
import { SignalService } from './signal.service';

describe('SignalService', () => {
  let service: SignalService;
  let aiClient: jest.Mocked<IAiServiceClient>;

  beforeEach(() => {
    aiClient = {
      chat: jest.fn(),
      postSignal: jest.fn(),
      getUserContext: jest.fn(),
    };
    service = new SignalService(aiClient);
  });

  it('injects user_id from the Clerk token and forwards the enriched payload', async () => {
    const body: SignalResponse = { status: 'accepted' };
    aiClient.postSignal.mockResolvedValueOnce(body);

    const dto: SignalRequestDto = {
      signal_type: 'recommendation_accepted',
      recommendation_id: 'rec_1',
      place_id: 'google:abc',
    };

    const result = await service.submit('user_clerk_123', dto);

    expect(aiClient.postSignal).toHaveBeenCalledWith({
      signal_type: 'recommendation_accepted',
      recommendation_id: 'rec_1',
      place_id: 'google:abc',
      user_id: 'user_clerk_123',
    });
    expect(result).toEqual(body);
  });

  it('forwards rejected signals the same way', async () => {
    aiClient.postSignal.mockResolvedValueOnce({ status: 'accepted' });

    const dto: SignalRequestDto = {
      signal_type: 'recommendation_rejected',
      recommendation_id: 'rec_2',
      place_id: 'google:def',
    };

    await service.submit('user_clerk_456', dto);

    expect(aiClient.postSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        signal_type: 'recommendation_rejected',
        user_id: 'user_clerk_456',
      })
    );
  });

  it('forwards chip_confirm with its full chips metadata (no outer round)', async () => {
    aiClient.postSignal.mockResolvedValueOnce({ status: 'accepted' });

    const dto: SignalRequestDto = {
      signal_type: 'chip_confirm',
      metadata: {
        chips: [
          {
            label: 'Ramen lover',
            source_field: 'attributes.cuisine',
            source_value: 'ramen',
            signal_count: 3,
            status: 'confirmed',
            selection_round: 'round_1',
          },
          {
            label: 'Casual spots',
            source_field: 'attributes.ambiance',
            source_value: 'casual',
            signal_count: 2,
            status: 'rejected',
            selection_round: 'round_1',
          },
        ],
      },
    };

    await service.submit('user_clerk_789', dto);

    expect(aiClient.postSignal).toHaveBeenCalledWith({
      signal_type: 'chip_confirm',
      user_id: 'user_clerk_789',
      metadata: {
        chips: [
          {
            label: 'Ramen lover',
            source_field: 'attributes.cuisine',
            source_value: 'ramen',
            signal_count: 3,
            status: 'confirmed',
            selection_round: 'round_1',
          },
          {
            label: 'Casual spots',
            source_field: 'attributes.ambiance',
            source_value: 'casual',
            signal_count: 2,
            status: 'rejected',
            selection_round: 'round_1',
          },
        ],
      },
    });
  });

  it('propagates upstream errors so the global filter can translate them', async () => {
    const upstream = new Error('Recommendation not found');
    aiClient.postSignal.mockRejectedValueOnce(upstream);

    await expect(
      service.submit('user_clerk_123', {
        signal_type: 'recommendation_accepted',
        recommendation_id: 'bogus',
        place_id: 'google:abc',
      })
    ).rejects.toBe(upstream);
  });
});
