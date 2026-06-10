import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { PassThrough } from 'stream';
import type { AxiosResponse } from 'axios';
import { KebiHttpClient } from './kebi-http.client';

const BASE_URL = 'http://localhost:8000';
const SECRET = 'test-shared-secret';
const USER_ID = 'user_abc';
const GATEWAY_HEADERS = {
  'X-Gateway-Token': SECRET,
  'X-Gateway-User-Id': USER_ID,
};
const STD_CONFIG = { timeout: 30000, headers: GATEWAY_HEADERS };

describe('KebiHttpClient', () => {
  let client: KebiHttpClient;
  let configService: ConfigService;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'KEBI_BASE_URL') return BASE_URL;
        if (key === 'GATEWAY_SHARED_SECRET') return SECRET;
        return undefined;
      }),
    } as unknown as ConfigService;

    httpService = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<HttpService>;

    client = new KebiHttpClient(configService, httpService);
  });

  describe('initialization', () => {
    it('initializes with a valid base URL and shared secret', () => {
      expect(client).toBeDefined();
      expect(configService.get).toHaveBeenCalledWith('KEBI_BASE_URL');
      expect(configService.get).toHaveBeenCalledWith('GATEWAY_SHARED_SECRET');
    });

    it('throws if KEBI_BASE_URL is not configured', () => {
      const cfg = {
        get: jest.fn(() => undefined),
      } as unknown as ConfigService;

      expect(() => new KebiHttpClient(cfg, httpService)).toThrow(
        'KEBI_BASE_URL is not configured'
      );
    });

    it('fails closed when GATEWAY_SHARED_SECRET is missing', () => {
      const cfg = {
        get: jest.fn((key: string) =>
          key === 'KEBI_BASE_URL' ? BASE_URL : undefined
        ),
      } as unknown as ConfigService;

      expect(() => new KebiHttpClient(cfg, httpService)).toThrow(
        'GATEWAY_SHARED_SECRET is not configured'
      );
    });
  });

  describe('get()', () => {
    it('GETs the prefixed URL with gateway headers + timeout and unwraps data', async () => {
      const body = { ok: true };
      (httpService.get as jest.Mock).mockReturnValueOnce(
        of({ data: body } as AxiosResponse)
      );

      const result = await client.get('/v1/user/library', USER_ID);

      expect(httpService.get).toHaveBeenCalledWith(
        `${BASE_URL}/v1/user/library`,
        STD_CONFIG
      );
      expect(result).toEqual(body);
    });
  });

  describe('post()', () => {
    it('POSTs the body with gateway headers and unwraps data', async () => {
      const body = { status: 'accepted' };
      (httpService.post as jest.Mock).mockReturnValueOnce(
        of({ data: body } as AxiosResponse)
      );

      const result = await client.post('/v1/signal', USER_ID, { a: 1 });

      expect(httpService.post).toHaveBeenCalledWith(
        `${BASE_URL}/v1/signal`,
        { a: 1 },
        STD_CONFIG
      );
      expect(result).toEqual(body);
    });

    it('propagates upstream errors raw', async () => {
      const upstream = Object.assign(new Error('upstream 503'), {
        isAxiosError: true,
        response: { status: 503 },
      });
      (httpService.post as jest.Mock).mockImplementationOnce(() => {
        throw upstream;
      });

      await expect(client.post('/v1/signal', USER_ID, {})).rejects.toBe(
        upstream
      );
    });
  });

  describe('patch()', () => {
    it('PATCHes the body with gateway headers and unwraps data', async () => {
      const body = { updated: true };
      (httpService.patch as jest.Mock).mockReturnValueOnce(
        of({ data: body } as AxiosResponse)
      );

      const result = await client.patch('/v1/user/places/up_1', USER_ID, {
        visited: true,
      });

      expect(httpService.patch).toHaveBeenCalledWith(
        `${BASE_URL}/v1/user/places/up_1`,
        { visited: true },
        STD_CONFIG
      );
      expect(result).toEqual(body);
    });
  });

  describe('delete()', () => {
    it('DELETEs the prefixed URL with gateway headers', async () => {
      (httpService.delete as jest.Mock).mockReturnValueOnce(
        of({ data: undefined } as AxiosResponse<void>)
      );

      await client.delete('/v1/user/data', USER_ID);

      expect(httpService.delete).toHaveBeenCalledWith(
        `${BASE_URL}/v1/user/data`,
        STD_CONFIG
      );
    });
  });

  describe('postStream()', () => {
    it('POSTs as a raw stream with gateway headers and forwards the AbortSignal', async () => {
      const fakeStream = new PassThrough();
      (httpService.post as jest.Mock).mockReturnValueOnce(
        of({ data: fakeStream } as unknown as AxiosResponse)
      );

      const controller = new AbortController();
      const result = await client.postStream(
        '/v1/chat/stream',
        USER_ID,
        { message: 'hi' },
        controller.signal
      );

      expect(httpService.post).toHaveBeenCalledWith(
        `${BASE_URL}/v1/chat/stream`,
        { message: 'hi' },
        {
          responseType: 'stream',
          timeout: 30000,
          signal: controller.signal,
          headers: GATEWAY_HEADERS,
        }
      );
      expect(result).toBe(fakeStream);
    });

    it('passes signal: undefined when none is given', async () => {
      const fakeStream = new PassThrough();
      (httpService.post as jest.Mock).mockReturnValueOnce(
        of({ data: fakeStream } as unknown as AxiosResponse)
      );

      await client.postStream('/v1/chat/stream', USER_ID, { message: 'hi' });

      expect(httpService.post).toHaveBeenCalledWith(
        `${BASE_URL}/v1/chat/stream`,
        { message: 'hi' },
        {
          responseType: 'stream',
          timeout: 30000,
          signal: undefined,
          headers: GATEWAY_HEADERS,
        }
      );
    });
  });
});
