import type { CurateKnowledgeResponse } from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import { CurateKnowledgeDto } from './dto/curate-knowledge-request.dto';
import { KnowledgeService } from './knowledge.service';

const RESPONSE: CurateKnowledgeResponse = {
  claims_written: 1,
  claims: [{ scope: 'city', entity_name: 'Dubai', claim: 'Nightlife peaks after midnight.', tags: ['nightlife'] }],
};

describe('KnowledgeService', () => {
  let service: KnowledgeService;
  let kebi: jest.Mocked<KebiHttpClient>;

  beforeEach(() => {
    kebi = { post: jest.fn() } as unknown as jest.Mocked<KebiHttpClient>;
    service = new KnowledgeService(kebi);
  });

  it('forwards prose + location_hint and the caller curator role as a capability', async () => {
    (kebi.post as jest.Mock).mockResolvedValueOnce(RESPONSE);

    const dto: CurateKnowledgeDto = {
      text: 'Dubai nightlife peaks after midnight.',
      location_hint: { country_alpha2: 'ae', city: 'Dubai' },
    };

    const result = await service.curate('user_1', dto, true);

    expect(kebi.post).toHaveBeenCalledWith(
      '/v1/knowledge/curate',
      'user_1',
      { text: dto.text, location_hint: dto.location_hint },
      undefined,
      { canCurate: true },
    );
    expect(result).toEqual(RESPONSE);
  });

  it('forwards canCurate: false (kebi fails closed as defense in depth)', async () => {
    (kebi.post as jest.Mock).mockResolvedValueOnce(RESPONSE);

    await service.curate('user_2', { text: 'some prose' }, false);

    expect(kebi.post).toHaveBeenCalledWith(
      '/v1/knowledge/curate',
      'user_2',
      { text: 'some prose', location_hint: undefined },
      undefined,
      { canCurate: false },
    );
  });

  it('propagates upstream errors to the caller', async () => {
    const err = new Error('kebi 403');
    (kebi.post as jest.Mock).mockRejectedValueOnce(err);

    await expect(service.curate('user_1', { text: 'x' }, true)).rejects.toBe(err);
  });
});
