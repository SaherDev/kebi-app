import type {
  CurateKnowledgeResponse,
  EntitySearchResponse,
  KnowledgeClaimsResponse,
} from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import { CurateKnowledgeDto } from './dto/curate-knowledge-request.dto';
import { KnowledgeService } from './knowledge.service';

const RESPONSE: CurateKnowledgeResponse = {
  claims_written: 1,
  claims: [
    {
      id: 'claim_1',
      scope: 'city',
      entity_name: 'Dubai',
      claim: 'Nightlife peaks after midnight.',
      tags: ['nightlife'],
    },
  ],
};

const CLAIMS: KnowledgeClaimsResponse = {
  claims: [
    {
      id: 'claim_1',
      scope: 'place',
      claim: 'Cash only at the bar.',
      tags: ['cash_only'],
      created_at: '2026-08-10T12:00:00Z',
      anchor: { type: 'place', place_id: 'place_1', area_id: null, name: 'Beach Club X' },
    },
  ],
  next_cursor: null,
};

const ENTITIES: EntitySearchResponse = {
  results: [
    {
      type: 'area',
      place_id: null,
      area_id: 'aWQvYmFsaS9jYW5nZ3U',
      name: 'Canggu',
      level: 'neighbourhood',
      icon: null,
      context: 'Bali, ID',
    },
  ],
};

describe('KnowledgeService', () => {
  let service: KnowledgeService;
  let kebi: jest.Mocked<KebiHttpClient>;

  beforeEach(() => {
    kebi = {
      post: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<KebiHttpClient>;
    service = new KnowledgeService(kebi);
  });

  describe('curate', () => {
    it('forwards prose + anchor and the caller curator role as a capability', async () => {
      (kebi.post as jest.Mock).mockResolvedValueOnce(RESPONSE);

      const dto: CurateKnowledgeDto = {
        text: 'Cash only at the bar.',
        anchor: { place_id: 'place_1' },
      };

      const result = await service.curate('user_1', dto, true);

      expect(kebi.post).toHaveBeenCalledWith(
        '/v1/knowledge/curate',
        'user_1',
        { text: dto.text, anchor: dto.anchor },
        undefined,
        { canCurate: true },
      );
      expect(result).toEqual(RESPONSE);
    });

    it('forwards an area anchor unchanged (the encoded token, not a geo key)', async () => {
      (kebi.post as jest.Mock).mockResolvedValueOnce(RESPONSE);

      await service.curate(
        'user_1',
        { text: 'prose', anchor: { area_id: 'aWQvYmFsaS9jYW5nZ3U' } },
        true,
      );

      expect(kebi.post).toHaveBeenCalledWith(
        '/v1/knowledge/curate',
        'user_1',
        { text: 'prose', anchor: { area_id: 'aWQvYmFsaS9jYW5nZ3U' } },
        undefined,
        { canCurate: true },
      );
    });

    it('sends anchor: undefined when unanchored (kebi then stays geo-scoped)', async () => {
      (kebi.post as jest.Mock).mockResolvedValueOnce(RESPONSE);

      await service.curate('user_2', { text: 'some prose' }, false);

      expect(kebi.post).toHaveBeenCalledWith(
        '/v1/knowledge/curate',
        'user_2',
        { text: 'some prose', anchor: undefined },
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

  describe('listClaims', () => {
    it('forwards pagination params and the curator capability', async () => {
      (kebi.get as jest.Mock).mockResolvedValueOnce(CLAIMS);

      const result = await service.listClaims('user_1', { limit: 20, cursor: 'abc' }, true);

      expect(kebi.get).toHaveBeenCalledWith('/v1/knowledge/claims?limit=20&cursor=abc', 'user_1', {
        canCurate: true,
      });
      expect(result).toEqual(CLAIMS);
    });

    it('omits the query string entirely when no params are given', async () => {
      (kebi.get as jest.Mock).mockResolvedValueOnce(CLAIMS);

      await service.listClaims('user_1', {}, true);

      expect(kebi.get).toHaveBeenCalledWith('/v1/knowledge/claims', 'user_1', { canCurate: true });
    });
  });

  describe('retractClaim', () => {
    it('deletes by id, carrying the curator capability', async () => {
      (kebi.delete as jest.Mock).mockResolvedValueOnce(undefined);

      await service.retractClaim('user_1', 'claim_1', true);

      expect(kebi.delete).toHaveBeenCalledWith('/v1/knowledge/claims/claim_1', 'user_1', {
        canCurate: true,
      });
    });

    it('encodes the id so a path-shaped value cannot escape the route', async () => {
      (kebi.delete as jest.Mock).mockResolvedValueOnce(undefined);

      await service.retractClaim('user_1', '../../v1/user/data', true);

      expect(kebi.delete).toHaveBeenCalledWith(
        '/v1/knowledge/claims/..%2F..%2Fv1%2Fuser%2Fdata',
        'user_1',
        { canCurate: true },
      );
    });
  });

  describe('searchEntities', () => {
    it('forwards the typeahead term and the curator capability', async () => {
      (kebi.get as jest.Mock).mockResolvedValueOnce(ENTITIES);

      const result = await service.searchEntities('user_1', { q: 'canggu', limit: 8 }, true);

      expect(kebi.get).toHaveBeenCalledWith('/v1/knowledge/entities?q=canggu&limit=8', 'user_1', {
        canCurate: true,
      });
      expect(result).toEqual(ENTITIES);
    });

    it('url-encodes the term', async () => {
      (kebi.get as jest.Mock).mockResolvedValueOnce(ENTITIES);

      await service.searchEntities('user_1', { q: 'bear pond & co' }, true);

      expect(kebi.get).toHaveBeenCalledWith(
        '/v1/knowledge/entities?q=bear+pond+%26+co',
        'user_1',
        { canCurate: true },
      );
    });
  });
});
