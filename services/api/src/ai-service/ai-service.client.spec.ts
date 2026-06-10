import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { PassThrough } from 'stream';
import type { AxiosResponse } from 'axios';
import type {
  ChatRequestDto,
  ExtractPlaceRequest,
  ExtractPlaceResponse,
  LibraryResponse,
  LibraryUserData,
  SignalRequest,
  SignalResponse,
  UpdateUserPlaceRequest,
} from '@kebi-app/shared';
import { AiServiceClient } from './ai-service.client';

const BASE_URL = 'http://localhost:8000';
const SECRET = 'test-shared-secret';
const USER_ID = 'user_abc';
const GATEWAY_HEADERS = {
  'X-Gateway-Token': SECRET,
  'X-Gateway-User-Id': USER_ID,
};

describe('AiServiceClient', () => {
  let client: AiServiceClient;
  let configService: ConfigService;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'AI_SERVICE_BASE_URL') return BASE_URL;
        if (key === 'GATEWAY_SHARED_SECRET') return SECRET;
        return undefined;
      }),
    } as unknown as ConfigService;

    httpService = {
      post: jest.fn(),
      get: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<HttpService>;

    client = new AiServiceClient(configService, httpService);
  });

  describe('initialization', () => {
    it('initializes with a valid base URL and shared secret', () => {
      expect(client).toBeDefined();
      expect(configService.get).toHaveBeenCalledWith('AI_SERVICE_BASE_URL');
      expect(configService.get).toHaveBeenCalledWith('GATEWAY_SHARED_SECRET');
    });

    it('throws if base_url is not configured', () => {
      const cfg = {
        get: jest.fn(() => undefined),
      } as unknown as ConfigService;

      expect(() => new AiServiceClient(cfg, httpService)).toThrow(
        'AI_SERVICE_BASE_URL is not configured'
      );
    });

    it('fails closed when GATEWAY_SHARED_SECRET is missing', () => {
      const cfg = {
        get: jest.fn((key: string) =>
          key === 'AI_SERVICE_BASE_URL' ? BASE_URL : undefined
        ),
      } as unknown as ConfigService;

      expect(() => new AiServiceClient(cfg, httpService)).toThrow(
        'GATEWAY_SHARED_SECRET is not configured'
      );
    });
  });

  describe('chatStream()', () => {
    const payload: ChatRequestDto = {
      message: 'good ramen nearby',
      location: null,
      movement_profile: null,
    };

    it('POSTs /v1/chat/stream as a raw stream with gateway auth headers', async () => {
      const fakeStream = new PassThrough();
      const response = { data: fakeStream } as unknown as AxiosResponse;
      httpService.post.mockReturnValueOnce(of(response));

      const result = await client.chatStream(payload, USER_ID);

      expect(httpService.post).toHaveBeenCalledWith(
        `${BASE_URL}/v1/chat/stream`,
        payload,
        {
          responseType: 'stream',
          timeout: 30000,
          signal: undefined,
          headers: GATEWAY_HEADERS,
        }
      );
      expect(result).toBe(fakeStream);
    });

    it('forwards the AbortSignal so the upstream connection is cancellable', async () => {
      const fakeStream = new PassThrough();
      const response = { data: fakeStream } as unknown as AxiosResponse;
      httpService.post.mockReturnValueOnce(of(response));

      const controller = new AbortController();
      await client.chatStream(payload, USER_ID, controller.signal);

      expect(httpService.post).toHaveBeenCalledWith(
        `${BASE_URL}/v1/chat/stream`,
        payload,
        {
          responseType: 'stream',
          timeout: 30000,
          signal: controller.signal,
          headers: GATEWAY_HEADERS,
        }
      );
    });

    it('propagates upstream errors raw', async () => {
      const upstream = Object.assign(new Error('upstream 503'), {
        isAxiosError: true,
        response: { status: 503 },
      });
      httpService.post.mockImplementationOnce(() => {
        throw upstream;
      });

      await expect(client.chatStream(payload, USER_ID)).rejects.toBe(upstream);
    });
  });

  describe('postSignal()', () => {
    const payload: SignalRequest = {
      signal_type: 'recommendation_accepted',
      recommendation_id: 'rec_123',
      place_core_id: 'c0ffee00-1111-2222-3333-444455556666',
    };

    it('POSTs /v1/signal with gateway auth headers (no user_id in body)', async () => {
      const body: SignalResponse = { status: 'accepted' };
      const response = { data: body } as AxiosResponse<SignalResponse>;
      httpService.post.mockReturnValueOnce(of(response));

      const result = await client.postSignal(payload, USER_ID);

      expect(httpService.post).toHaveBeenCalledWith(
        `${BASE_URL}/v1/signal`,
        payload,
        { timeout: 30000, headers: GATEWAY_HEADERS }
      );
      expect(result).toEqual(body);
    });

    it('propagates upstream errors raw', async () => {
      const upstream = Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        response: { status: 422 },
      });
      httpService.post.mockImplementationOnce(() => {
        throw upstream;
      });

      await expect(client.postSignal(payload, USER_ID)).rejects.toBe(upstream);
    });
  });

  describe('extractPlace()', () => {
    const payload: ExtractPlaceRequest = {
      raw_input: 'https://www.tiktok.com/@user/video/123',
    };

    it('POSTs /v1/extract with gateway auth headers', async () => {
      const body: ExtractPlaceResponse = {
        status: 'completed',
        results: [],
        raw_input: payload.raw_input,
        request_id: '9f1c',
        failure_reason: null,
        failure_message: null,
      };
      const response = { data: body } as AxiosResponse<ExtractPlaceResponse>;
      httpService.post.mockReturnValueOnce(of(response));

      const result = await client.extractPlace(payload, USER_ID);

      expect(httpService.post).toHaveBeenCalledWith(
        `${BASE_URL}/v1/extract`,
        payload,
        { timeout: 30000, headers: GATEWAY_HEADERS }
      );
      expect(result).toEqual(body);
    });
  });

  describe('deleteUserData()', () => {
    it('DELETEs /v1/user/data (no id segment) with gateway auth headers', async () => {
      const response = { data: undefined } as AxiosResponse<void>;
      (httpService.delete as jest.Mock).mockReturnValueOnce(of(response));

      await client.deleteUserData(USER_ID);

      expect(httpService.delete).toHaveBeenCalledWith(
        `${BASE_URL}/v1/user/data`,
        { timeout: 30000, headers: GATEWAY_HEADERS }
      );
    });

    it('omits the query string when scopes is undefined or empty', async () => {
      const response = { data: undefined } as AxiosResponse<void>;
      (httpService.delete as jest.Mock).mockReturnValue(of(response));

      await client.deleteUserData(USER_ID, undefined);
      await client.deleteUserData(USER_ID, []);

      expect(httpService.delete).toHaveBeenNthCalledWith(
        1,
        `${BASE_URL}/v1/user/data`,
        { timeout: 30000, headers: GATEWAY_HEADERS }
      );
      expect(httpService.delete).toHaveBeenNthCalledWith(
        2,
        `${BASE_URL}/v1/user/data`,
        { timeout: 30000, headers: GATEWAY_HEADERS }
      );
    });

    it('serializes a single scope as ?scope=value', async () => {
      const response = { data: undefined } as AxiosResponse<void>;
      (httpService.delete as jest.Mock).mockReturnValueOnce(of(response));

      await client.deleteUserData(USER_ID, ['chat_history']);

      expect(httpService.delete).toHaveBeenCalledWith(
        `${BASE_URL}/v1/user/data?scope=chat_history`,
        { timeout: 30000, headers: GATEWAY_HEADERS }
      );
    });

    it('serializes multiple scopes as repeated ?scope= params', async () => {
      const response = { data: undefined } as AxiosResponse<void>;
      (httpService.delete as jest.Mock).mockReturnValueOnce(of(response));

      await client.deleteUserData(USER_ID, ['chat_history', 'all']);

      expect(httpService.delete).toHaveBeenCalledWith(
        `${BASE_URL}/v1/user/data?scope=chat_history&scope=all`,
        { timeout: 30000, headers: GATEWAY_HEADERS }
      );
    });

    it('propagates upstream errors raw', async () => {
      const upstream = Object.assign(new Error('upstream 500'), {
        isAxiosError: true,
        response: { status: 500 },
      });
      (httpService.delete as jest.Mock).mockImplementationOnce(() => {
        throw upstream;
      });

      await expect(client.deleteUserData(USER_ID)).rejects.toBe(upstream);
    });
  });

  describe('getUserLibrary()', () => {
    const body: LibraryResponse = { places: [], next_cursor: null };

    it('GETs /v1/user/library with no query string for an empty record', async () => {
      const response = { data: body } as AxiosResponse<LibraryResponse>;
      (httpService.get as jest.Mock).mockReturnValueOnce(of(response));

      const result = await client.getUserLibrary({}, USER_ID);

      expect(httpService.get).toHaveBeenCalledWith(`${BASE_URL}/v1/user/library`, {
        timeout: 30000,
        headers: GATEWAY_HEADERS,
      });
      expect(result).toEqual(body);
    });

    it('serializes scalar params and repeats array params (category/tag)', async () => {
      const response = { data: body } as AxiosResponse<LibraryResponse>;
      (httpService.get as jest.Mock).mockReturnValueOnce(of(response));

      await client.getUserLibrary(
        { category: ['cafe', 'bar'], sort: 'name', limit: '20' },
        USER_ID
      );

      expect(httpService.get).toHaveBeenCalledWith(
        `${BASE_URL}/v1/user/library?category=cafe&category=bar&sort=name&limit=20`,
        { timeout: 30000, headers: GATEWAY_HEADERS }
      );
    });
  });

  describe('updateUserPlace()', () => {
    const body: UpdateUserPlaceRequest = { visited: true };
    const updated = { user_place_id: 'up_1', visited: true } as LibraryUserData;

    it('PATCHes /v1/user/places/{id} with the partial body and gateway headers', async () => {
      const response = { data: updated } as AxiosResponse<LibraryUserData>;
      (httpService.patch as jest.Mock).mockReturnValueOnce(of(response));

      const result = await client.updateUserPlace('up_1', body, USER_ID);

      expect(httpService.patch).toHaveBeenCalledWith(
        `${BASE_URL}/v1/user/places/up_1`,
        body,
        { timeout: 30000, headers: GATEWAY_HEADERS }
      );
      expect(result).toEqual(updated);
    });

    it('url-encodes the path id', async () => {
      const response = { data: updated } as AxiosResponse<LibraryUserData>;
      (httpService.patch as jest.Mock).mockReturnValueOnce(of(response));

      await client.updateUserPlace('a/b 1', body, USER_ID);

      expect(httpService.patch).toHaveBeenCalledWith(
        `${BASE_URL}/v1/user/places/a%2Fb%201`,
        body,
        { timeout: 30000, headers: GATEWAY_HEADERS }
      );
    });

    it('propagates a 404 raw', async () => {
      const upstream = Object.assign(new Error('saved_place_not_found'), {
        isAxiosError: true,
        response: { status: 404 },
      });
      (httpService.patch as jest.Mock).mockImplementationOnce(() => {
        throw upstream;
      });

      await expect(client.updateUserPlace('missing', body, USER_ID)).rejects.toBe(
        upstream
      );
    });
  });

  describe('deleteUserPlace()', () => {
    it('DELETEs /v1/user/places/{id} with gateway headers', async () => {
      const response = { data: undefined } as AxiosResponse<void>;
      (httpService.delete as jest.Mock).mockReturnValueOnce(of(response));

      await client.deleteUserPlace('up_1', USER_ID);

      expect(httpService.delete).toHaveBeenCalledWith(
        `${BASE_URL}/v1/user/places/up_1`,
        { timeout: 30000, headers: GATEWAY_HEADERS }
      );
    });

    it('propagates a 404 raw', async () => {
      const upstream = Object.assign(new Error('saved_place_not_found'), {
        isAxiosError: true,
        response: { status: 404 },
      });
      (httpService.delete as jest.Mock).mockImplementationOnce(() => {
        throw upstream;
      });

      await expect(client.deleteUserPlace('missing', USER_ID)).rejects.toBe(upstream);
    });
  });
});
