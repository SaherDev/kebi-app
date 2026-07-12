import type { AuthUser, CurateKnowledgeResponse } from '@kebi-app/shared';
import { KnowledgeController } from './knowledge.controller';
import { CurateKnowledgeDto } from './dto/curate-knowledge-request.dto';
import { KnowledgeService } from './knowledge.service';

describe('KnowledgeController', () => {
  let controller: KnowledgeController;
  let service: jest.Mocked<KnowledgeService>;

  beforeEach(() => {
    service = { curate: jest.fn() } as unknown as jest.Mocked<KnowledgeService>;
    controller = new KnowledgeController(service);
  });

  it('is a facade — one service call passing the authed user id + curator role', async () => {
    const body: CurateKnowledgeResponse = { claims_written: 0, claims: [] };
    service.curate.mockResolvedValueOnce(body);

    const dto: CurateKnowledgeDto = { text: 'some expert prose' };
    const user: AuthUser = { id: 'user_test_123', ai_enabled: true, plan: 'explorer', can_curate: true };

    const result = await controller.curate(user, dto);

    expect(service.curate).toHaveBeenCalledTimes(1);
    expect(service.curate).toHaveBeenCalledWith('user_test_123', dto, true);
    expect(result).toEqual(body);
  });

  it('passes can_curate: false when the principal lacks the role claim', async () => {
    service.curate.mockResolvedValueOnce({ claims_written: 0, claims: [] });
    const user: AuthUser = { id: 'user_test_123', ai_enabled: true };

    await controller.curate(user, { text: 'prose' });

    expect(service.curate).toHaveBeenCalledWith('user_test_123', { text: 'prose' }, false);
  });
});
