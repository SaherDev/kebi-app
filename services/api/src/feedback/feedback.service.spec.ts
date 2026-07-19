import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { FeedbackRequestDto } from './dto/feedback-request.dto';
import { FeedbackService } from './feedback.service';
import { NOTION_VERSION } from './notion-page';

describe('FeedbackService', () => {
  let http: jest.Mocked<HttpService>;

  const dto: FeedbackRequestDto = { kind: 'bug', text: 'it crashed' } as FeedbackRequestDto;

  function makeService(env: Record<string, unknown> = {}): FeedbackService {
    const values: Record<string, unknown> = {
      'feedback.max_per_hour': 5,
      'feedback.notion_timeout_ms': 10000,
      NOTION_FEEDBACK_TOKEN: 'ntn_secret',
      NOTION_FEEDBACK_DATABASE_ID: 'db_123',
      ...env,
    };
    const config = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
    http = { post: jest.fn(() => of({ data: {} })) } as unknown as jest.Mocked<HttpService>;
    return new FeedbackService(config, http);
  }

  it('POSTs the Notion page with token, version header, and configured timeout', async () => {
    const service = makeService();

    const result = await service.submit('user_1', 'saher@example.com', dto);

    expect(http.post).toHaveBeenCalledTimes(1);
    const [url, body, options] = (http.post as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.notion.com/v1/pages');
    expect(body.parent).toEqual({ database_id: 'db_123' });
    expect(options.timeout).toBe(10000);
    expect(options.headers.Authorization).toBe('Bearer ntn_secret');
    expect(options.headers['Notion-Version']).toBe(NOTION_VERSION);
    expect(result).toEqual({ status: 'received' });
  });

  it('still resolves 202 when Notion is down — failure is logged, not surfaced', async () => {
    const service = makeService();
    (http.post as jest.Mock).mockReturnValueOnce(throwError(() => new Error('notion 500')));

    await expect(service.submit('user_1', undefined, dto)).resolves.toEqual({
      status: 'received',
    });
  });

  it('skips the forward and still resolves when credentials are blank', async () => {
    const service = makeService({ NOTION_FEEDBACK_TOKEN: '' });

    const result = await service.submit('user_1', undefined, dto);

    expect(http.post).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'received' });
  });

  it('caps submissions per user per hour with 429', async () => {
    const service = makeService();

    for (let i = 0; i < 5; i++) {
      await service.submit('user_1', undefined, dto);
    }
    await expect(service.submit('user_1', undefined, dto)).rejects.toMatchObject({
      status: 429,
    });
    // Other users are unaffected by user_1's cap.
    await expect(service.submit('user_2', undefined, dto)).resolves.toEqual({
      status: 'received',
    });
  });

  it('frees slots once submissions age out of the window', async () => {
    jest.useFakeTimers();
    try {
      const service = makeService();
      for (let i = 0; i < 5; i++) {
        await service.submit('user_1', undefined, dto);
      }
      jest.setSystemTime(Date.now() + 61 * 60 * 1000);
      await expect(service.submit('user_1', undefined, dto)).resolves.toEqual({
        status: 'received',
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('throws HttpException (not a plain error) when rate limited', async () => {
    const service = makeService({ 'feedback.max_per_hour': 1 });

    await service.submit('user_1', undefined, dto);
    await expect(service.submit('user_1', undefined, dto)).rejects.toBeInstanceOf(HttpException);
  });
});
