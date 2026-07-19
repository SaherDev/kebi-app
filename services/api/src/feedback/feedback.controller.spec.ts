import type { AuthUser, FeedbackResponse, NormalizedIdentity } from '@kebi-app/shared';
import { FeedbackController } from './feedback.controller';
import { FeedbackRequestDto } from './dto/feedback-request.dto';
import { FeedbackService } from './feedback.service';

describe('FeedbackController', () => {
  let controller: FeedbackController;
  let service: jest.Mocked<FeedbackService>;

  const user: AuthUser = { id: 'user_test_123', ai_enabled: true };
  const dto: FeedbackRequestDto = { kind: 'bug', text: 'it crashed' } as FeedbackRequestDto;

  beforeEach(() => {
    service = { submit: jest.fn() } as unknown as jest.Mocked<FeedbackService>;
    controller = new FeedbackController(service);
  });

  it('is a facade — one service call with the verified id, token email, and dto', async () => {
    const body: FeedbackResponse = { status: 'received' };
    service.submit.mockResolvedValueOnce(body);
    const identity = { email: 'saher@example.com' } as NormalizedIdentity;

    const result = await controller.submit(user, identity, dto);

    expect(service.submit).toHaveBeenCalledTimes(1);
    expect(service.submit).toHaveBeenCalledWith('user_test_123', 'saher@example.com', dto);
    expect(result).toEqual(body);
  });

  it('tolerates a missing identity (dev-bypass path) — email is undefined', async () => {
    service.submit.mockResolvedValueOnce({ status: 'received' });

    await controller.submit(user, undefined, dto);

    expect(service.submit).toHaveBeenCalledWith('user_test_123', undefined, dto);
  });
});
