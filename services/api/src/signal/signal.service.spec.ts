import type { SignalResponse } from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import { SignalRequestDto } from './dto/signal-request.dto';
import { SignalService } from './signal.service';

describe('SignalService', () => {
  let service: SignalService;
  let kebi: jest.Mocked<KebiHttpClient>;

  beforeEach(() => {
    kebi = { post: jest.fn() } as unknown as jest.Mocked<KebiHttpClient>;
    service = new SignalService(kebi);
  });

  it('POSTs /v1/signal with the verified user id as the header arg, never the body', async () => {
    const body: SignalResponse = { status: 'accepted' };
    (kebi.post as jest.Mock).mockResolvedValueOnce(body);

    const dto: SignalRequestDto = {
      signal_type: 'recommendation_accepted',
      recommendation_id: 'rec_1',
      place_core_id: 'c0ffee00-1111-2222-3333-444455556666',
    };

    const result = await service.submit('user_test_123', dto);

    expect(kebi.post).toHaveBeenCalledWith('/v1/signal', 'user_test_123', {
      signal_type: 'recommendation_accepted',
      recommendation_id: 'rec_1',
      place_core_id: 'c0ffee00-1111-2222-3333-444455556666',
    });
    expect(result).toEqual(body);
  });

  it('forwards rejected signals the same way', async () => {
    (kebi.post as jest.Mock).mockResolvedValueOnce({ status: 'accepted' });

    const dto: SignalRequestDto = {
      signal_type: 'recommendation_rejected',
      recommendation_id: 'rec_2',
      place_core_id: 'c0ffee00-2222-3333-4444-555566667777',
    };

    await service.submit('user_test_456', dto);

    expect(kebi.post).toHaveBeenCalledWith(
      '/v1/signal',
      'user_test_456',
      expect.objectContaining({ signal_type: 'recommendation_rejected' })
    );
  });

  it('propagates upstream errors so the global filter can translate them', async () => {
    const upstream = new Error('kebi error');
    (kebi.post as jest.Mock).mockRejectedValueOnce(upstream);

    await expect(
      service.submit('user_test_123', {
        signal_type: 'recommendation_accepted',
        recommendation_id: 'bogus',
        place_core_id: 'c0ffee00-9999-0000-1111-222233334444',
      })
    ).rejects.toBe(upstream);
  });
});
