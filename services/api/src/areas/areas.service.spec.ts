import type { AreaScreenView } from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import { AreasService } from './areas.service';

const USER_ID = 'user_test_123';
/** What a `kebi://area/{id}` link carries — the encoded key, not `id/bali/canggu`. */
const AREA_ID = 'aWQvYmFsaS9jYW5nZ3U';

describe('AreasService', () => {
  let service: AreasService;
  let kebi: jest.Mocked<KebiHttpClient>;

  beforeEach(() => {
    kebi = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<KebiHttpClient>;
    service = new AreasService(kebi);
  });

  it('GETs /v1/areas/{id} with the user id (header)', async () => {
    const view = {
      key: 'id/bali/canggu',
      name: 'Canggu',
      saved_count: 4,
      profiled: true,
    } as unknown as AreaScreenView;
    (kebi.get as jest.Mock).mockResolvedValueOnce(view);

    const result = await service.getArea(USER_ID, AREA_ID);

    expect(kebi.get).toHaveBeenCalledWith(`/v1/areas/${AREA_ID}`, USER_ID);
    expect(result).toBe(view);
  });

  it('encodes the area id into the path', async () => {
    (kebi.get as jest.Mock).mockResolvedValueOnce({});

    await service.getArea(USER_ID, 'a/b?c');

    expect(kebi.get).toHaveBeenCalledWith('/v1/areas/a%2Fb%3Fc', USER_ID);
  });

  it('propagates a 404 (area_not_found) from the transport', async () => {
    const err = new Error('area_not_found');
    (kebi.get as jest.Mock).mockRejectedValueOnce(err);

    await expect(service.getArea(USER_ID, 'not-a-token')).rejects.toBe(err);
  });
});
