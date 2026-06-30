import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { PassThrough } from 'stream';
import type { AxiosResponse } from 'axios';
import { KebiHttpClient } from './kebi-http.client';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { Entitlements } from '../entitlements/entitlements';

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
  let entitlementsService: jest.Mocked<EntitlementsService>;

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

    // resolve() is only hit on entitlement-gated calls (those passing a plan);
    // the calls below pass no plan, so it stays untouched and only the two auth
    // headers are stamped.
    entitlementsService = {
      resolve: jest.fn(),
    } as unknown as jest.Mocked<EntitlementsService>;

    client = new KebiHttpClient(configService, httpService, entitlementsService);
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

      expect(() => new KebiHttpClient(cfg, httpService, entitlementsService)).toThrow(
        'KEBI_BASE_URL is not configured'
      );
    });

    it('fails closed when GATEWAY_SHARED_SECRET is missing', () => {
      const cfg = {
        get: jest.fn((key: string) =>
          key === 'KEBI_BASE_URL' ? BASE_URL : undefined
        ),
      } as unknown as ConfigService;

      expect(() => new KebiHttpClient(cfg, httpService, entitlementsService)).toThrow(
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

  describe('entitlement headers (ADR-112)', () => {
    const CAPPED = new Entitlements({
      taste_enabled: false,
      discovery_enabled: false,
      advanced_models_enabled: false,
      save_limit: 10,
      consults_per_day: 3,
    });
    const UNLIMITED = new Entitlements({
      taste_enabled: true,
      discovery_enabled: true,
      advanced_models_enabled: true,
      save_limit: null,
      consults_per_day: null,
    });

    it('stamps booleans + numeric caps when a capped plan is supplied to post()', async () => {
      entitlementsService.resolve.mockReturnValueOnce(CAPPED);
      (httpService.post as jest.Mock).mockReturnValueOnce(
        of({ data: { ok: true } } as AxiosResponse)
      );

      await client.post('/v1/extract', USER_ID, { raw_input: 'x' }, 'homebody');

      const config = (httpService.post as jest.Mock).mock.calls[0][2];
      expect(config.headers).toEqual({
        ...GATEWAY_HEADERS,
        'X-Gateway-Taste-Enabled': 'false',
        'X-Gateway-Discovery-Enabled': 'false',
        'X-Gateway-Advanced-Models-Enabled': 'false',
        'X-Gateway-Save-Limit': '10',
        'X-Gateway-Consults-Per-Day': '3',
      });
      expect(entitlementsService.resolve).toHaveBeenCalledWith('homebody');
    });

    it('omits the numeric limit headers when unlimited (null)', async () => {
      entitlementsService.resolve.mockReturnValueOnce(UNLIMITED);
      (httpService.post as jest.Mock).mockReturnValueOnce(
        of({ data: { ok: true } } as AxiosResponse)
      );

      await client.post('/v1/user/places', USER_ID, {}, 'local_legend');

      const config = (httpService.post as jest.Mock).mock.calls[0][2];
      expect(config.headers['X-Gateway-Taste-Enabled']).toBe('true');
      expect(config.headers).not.toHaveProperty('X-Gateway-Save-Limit');
      expect(config.headers).not.toHaveProperty('X-Gateway-Consults-Per-Day');
    });

    it('stamps entitlements alongside the stream config on postStream()', async () => {
      entitlementsService.resolve.mockReturnValueOnce(UNLIMITED);
      const fakeStream = new PassThrough();
      (httpService.post as jest.Mock).mockReturnValueOnce(
        of({ data: fakeStream } as unknown as AxiosResponse)
      );

      await client.postStream(
        '/v1/chat/stream',
        USER_ID,
        { message: 'hi' },
        undefined,
        'local_legend'
      );

      const config = (httpService.post as jest.Mock).mock.calls[0][2];
      expect(config.responseType).toBe('stream');
      expect(config.headers['X-Gateway-Advanced-Models-Enabled']).toBe('true');
      expect(entitlementsService.resolve).toHaveBeenCalledWith('local_legend');
    });
  });
});
