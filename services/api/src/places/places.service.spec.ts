import type { PlaceView } from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import { PlacesService } from './places.service';

const USER_ID = 'user_test_123';

describe('PlacesService', () => {
  let service: PlacesService;
  let kebi: jest.Mocked<KebiHttpClient>;

  beforeEach(() => {
    kebi = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<KebiHttpClient>;
    service = new PlacesService(kebi);
  });

  it('GETs /v1/places/{id} with the user id (header)', async () => {
    const view = { place: { id: 'place_1' }, user_data: null, claims: [] } as unknown as PlaceView;
    (kebi.get as jest.Mock).mockResolvedValueOnce(view);

    const result = await service.getPlace(USER_ID, 'place_1');

    expect(kebi.get).toHaveBeenCalledWith('/v1/places/place_1', USER_ID);
    expect(result).toBe(view);
  });

  it('encodes the place id into the path', async () => {
    (kebi.get as jest.Mock).mockResolvedValueOnce({});

    await service.getPlace(USER_ID, 'a/b?c');

    expect(kebi.get).toHaveBeenCalledWith('/v1/places/a%2Fb%3Fc', USER_ID);
  });

  it('propagates a 404 (place_not_found) from the transport', async () => {
    const err = new Error('place_not_found');
    (kebi.get as jest.Mock).mockRejectedValueOnce(err);

    await expect(service.getPlace(USER_ID, 'missing')).rejects.toBe(err);
  });
});
