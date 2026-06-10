import type { ExtractPlaceResponse } from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import { ExtractRequestDto } from './dto/extract-request.dto';
import { ExtractService } from './extract.service';

describe('ExtractService', () => {
  let service: ExtractService;
  let kebi: jest.Mocked<KebiHttpClient>;

  beforeEach(() => {
    kebi = { post: jest.fn() } as unknown as jest.Mocked<KebiHttpClient>;
    service = new ExtractService(kebi);
  });

  it('POSTs /v1/extract with raw_input and the verified user id (header)', async () => {
    const response: ExtractPlaceResponse = {
      status: 'completed',
      results: [],
      raw_input: 'https://www.tiktok.com/@user/video/123',
      request_id: '9f1c',
      failure_reason: null,
      failure_message: null,
    };
    (kebi.post as jest.Mock).mockResolvedValueOnce(response);

    const dto: ExtractRequestDto = {
      raw_input: 'https://www.tiktok.com/@user/video/123',
    };

    const result = await service.extract('user_test_123', dto);

    expect(kebi.post).toHaveBeenCalledWith('/v1/extract', 'user_test_123', {
      raw_input: 'https://www.tiktok.com/@user/video/123',
    });
    expect(result).toEqual(response);
  });

  it('propagates upstream errors to the caller', async () => {
    const err = new Error('kebi pipeline error');
    (kebi.post as jest.Mock).mockRejectedValueOnce(err);

    await expect(
      service.extract('user_test_123', { raw_input: 'a place' })
    ).rejects.toBe(err);
  });
});
