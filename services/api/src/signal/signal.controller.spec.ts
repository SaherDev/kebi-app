import type { AuthUser, SignalResponse } from '@kebi-app/shared';
import { SignalController } from './signal.controller';
import { SignalRequestDto } from './dto/signal-request.dto';
import { SignalService } from './signal.service';

describe('SignalController', () => {
  let controller: SignalController;
  let service: jest.Mocked<SignalService>;

  beforeEach(() => {
    service = { submit: jest.fn() } as unknown as jest.Mocked<SignalService>;
    controller = new SignalController(service);
  });

  it('is a facade — makes exactly one service call and returns its value', async () => {
    const body: SignalResponse = { status: 'accepted' };
    service.submit.mockResolvedValueOnce(body);

    const dto: SignalRequestDto = {
      signal_type: 'recommendation_accepted',
      recommendation_id: 'rec_1',
      place_core_id: 'c0ffee00-1111-2222-3333-444455556666',
    };
    const user: AuthUser = { id: 'user_clerk_123', ai_enabled: true };

    const result = await controller.submit(user, dto);

    expect(service.submit).toHaveBeenCalledTimes(1);
    expect(service.submit).toHaveBeenCalledWith('user_clerk_123', dto);
    expect(result).toEqual(body);
  });
});
