import type {
  AuthUser,
  CurateKnowledgeResponse,
  EntitySearchResponse,
  KnowledgeClaimsResponse,
} from '@kebi-app/shared';
import { CuratorGuard } from '../common/guards/curator.guard';
import { KnowledgeController } from './knowledge.controller';
import { CurateKnowledgeDto } from './dto/curate-knowledge-request.dto';
import { KnowledgeService } from './knowledge.service';

const CURATOR: AuthUser = {
  id: 'user_test_123',
  ai_enabled: true,
  plan: 'explorer',
  can_curate: true,
};

describe('KnowledgeController', () => {
  let controller: KnowledgeController;
  let service: jest.Mocked<KnowledgeService>;

  beforeEach(() => {
    service = {
      curate: jest.fn(),
      listClaims: jest.fn(),
      retractClaim: jest.fn(),
      searchEntities: jest.fn(),
    } as unknown as jest.Mocked<KnowledgeService>;
    controller = new KnowledgeController(service);
  });

  describe('access control', () => {
    /** Every method on the controller carrying a route decorator. */
    const routeHandlers = Object.getOwnPropertyNames(KnowledgeController.prototype)
      .filter((name) => name !== 'constructor')
      .filter((name) => {
        const handler = Object.getOwnPropertyDescriptor(
          KnowledgeController.prototype,
          name,
        )?.value;
        return Reflect.hasMetadata('path', handler);
      });

    it('gates the whole controller on CuratorGuard, so a route added later is gated by default', () => {
      const guards: unknown[] = Reflect.getMetadata('__guards__', KnowledgeController) ?? [];
      expect(guards).toContain(CuratorGuard);
    });

    it('covers every route — a non-curator can reach none of them', () => {
      // The guard is class-level, so coverage is by construction. This asserts
      // the set it covers is the *whole* route set: if someone moves the guard
      // to per-method decorators, any route they forget fails here.
      expect(routeHandlers.sort()).toEqual([
        'curate',
        'listClaims',
        'retractClaim',
        'searchEntities',
      ]);

      const classGuards: unknown[] = Reflect.getMetadata('__guards__', KnowledgeController) ?? [];
      for (const name of routeHandlers) {
        const handler = Object.getOwnPropertyDescriptor(
          KnowledgeController.prototype,
          name,
        )?.value;
        const methodGuards: unknown[] = Reflect.getMetadata('__guards__', handler) ?? [];
        expect([...classGuards, ...methodGuards]).toContain(CuratorGuard);
      }
    });
  });

  describe('curate', () => {
    it('is a facade — one service call passing the authed user id + curator role', async () => {
      const body: CurateKnowledgeResponse = { claims_written: 0, claims: [] };
      service.curate.mockResolvedValueOnce(body);

      const dto: CurateKnowledgeDto = { text: 'some expert prose', anchor: { place_id: 'p1' } };

      const result = await controller.curate(CURATOR, dto);

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

  describe('listClaims', () => {
    it('forwards the query and the curator role', async () => {
      const page: KnowledgeClaimsResponse = { claims: [], next_cursor: null };
      service.listClaims.mockResolvedValueOnce(page);

      const result = await controller.listClaims(CURATOR, { limit: 20 });

      expect(service.listClaims).toHaveBeenCalledWith('user_test_123', { limit: 20 }, true);
      expect(result).toEqual(page);
    });

    it('passes can_curate: false when the claim is absent', async () => {
      service.listClaims.mockResolvedValueOnce({ claims: [], next_cursor: null });

      await controller.listClaims({ id: 'u', ai_enabled: true }, {});

      expect(service.listClaims).toHaveBeenCalledWith('u', {}, false);
    });
  });

  describe('retractClaim', () => {
    it('forwards the claim id and the curator role, returning nothing (204)', async () => {
      service.retractClaim.mockResolvedValueOnce(undefined);

      const result = await controller.retractClaim(CURATOR, 'claim_1');

      expect(service.retractClaim).toHaveBeenCalledWith('user_test_123', 'claim_1', true);
      expect(result).toBeUndefined();
    });

    it('propagates the upstream 404 rather than translating it', async () => {
      const err = new Error('kebi 404 claim_not_found');
      service.retractClaim.mockRejectedValueOnce(err);

      await expect(controller.retractClaim(CURATOR, 'not_mine')).rejects.toBe(err);
    });
  });

  describe('searchEntities', () => {
    it('forwards the typeahead query and the curator role', async () => {
      const results: EntitySearchResponse = { results: [] };
      service.searchEntities.mockResolvedValueOnce(results);

      const result = await controller.searchEntities(CURATOR, { q: 'canggu' });

      expect(service.searchEntities).toHaveBeenCalledWith('user_test_123', { q: 'canggu' }, true);
      expect(result).toEqual(results);
    });
  });
});
