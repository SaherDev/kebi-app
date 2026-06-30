import type { AuthUser, ExtractPlaceResponse } from '@kebi-app/shared';
import { ExtractController } from './extract.controller';
import { ExtractRequestDto } from './dto/extract-request.dto';
import { ExtractService } from './extract.service';

describe('ExtractController', () => {
  let controller: ExtractController;
  let service: jest.Mocked<ExtractService>;

  beforeEach(() => {
    service = { extract: jest.fn() } as unknown as jest.Mocked<ExtractService>;
    controller = new ExtractController(service);
  });

  it('is a facade — one service call with the authed user id, return value forwarded', async () => {
    const body: ExtractPlaceResponse = {
      status: 'completed',
      results: [],
      raw_input: 'a place',
      request_id: 'abc',
      failure_reason: null,
      failure_message: null,
    };
    service.extract.mockResolvedValueOnce(body);

    const dto: ExtractRequestDto = { raw_input: 'a place' };
    const user: AuthUser = { id: 'user_test_123', ai_enabled: true, plan: 'explorer' };

    const result = await controller.extract(user, dto);

    expect(service.extract).toHaveBeenCalledTimes(1);
    expect(service.extract).toHaveBeenCalledWith('user_test_123', dto, 'explorer');
    expect(result).toEqual(body);
  });
});
