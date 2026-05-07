import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { PassThrough } from 'stream';
import type { AxiosResponse } from 'axios';
import {
  ChatRequestDto,
  SignalRequestWithUser,
  SignalResponse,
  AiUserContext,
} from '@kebi-app/shared';
import { AiServiceClient } from './ai-service.client';

describe('AiServiceClient', () => {
  let client: AiServiceClient;
  let configService: ConfigService;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'AI_SERVICE_BASE_URL') {
          return 'http://localhost:8000';
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    httpService = {
      post: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<HttpService>;

    client = new AiServiceClient(configService, httpService);
  });

  describe('initialization', () => {
    it('should initialize with valid base URL', () => {
      expect(client).toBeDefined();
      expect(configService.get).toHaveBeenCalledWith('AI_SERVICE_BASE_URL');
    });

    it('should throw if base_url is not configured', () => {
      const configServiceNoUrl = {
        get: jest.fn(() => undefined),
      } as unknown as ConfigService;

      expect(
        () => new AiServiceClient(configServiceNoUrl, httpService)
      ).toThrow('AI_SERVICE_BASE_URL is not configured');
    });
  });

  describe('chatStream()', () => {
    const payload: ChatRequestDto = {
      user_id: 'user_abc',
      message: 'good ramen nearby',
      location: null,
      signal_tier: null,
    };

    it('calls POST /v1/chat/stream with responseType: stream and returns the body stream', async () => {
      const fakeStream = new PassThrough();
      const response = { data: fakeStream } as unknown as AxiosResponse;
      httpService.post.mockReturnValueOnce(of(response));

      const result = await client.chatStream(payload);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:8000/v1/chat/stream',
        payload,
        { responseType: 'stream', timeout: 30000, signal: undefined }
      );
      expect(result).toBe(fakeStream);
    });

    it('forwards AbortSignal to axios so the upstream connection is cancelled on abort', async () => {
      const fakeStream = new PassThrough();
      const response = { data: fakeStream } as unknown as AxiosResponse;
      httpService.post.mockReturnValueOnce(of(response));

      const controller = new AbortController();
      await client.chatStream(payload, controller.signal);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:8000/v1/chat/stream',
        payload,
        { responseType: 'stream', timeout: 30000, signal: controller.signal }
      );
    });

    it('propagates upstream errors raw so AllExceptionsFilter can translate them', async () => {
      const upstream = Object.assign(new Error('upstream 503'), {
        isAxiosError: true,
        response: { status: 503 },
      });
      httpService.post.mockImplementationOnce(() => { throw upstream; });

      await expect(client.chatStream(payload)).rejects.toBe(upstream);
    });
  });

  describe('postSignal()', () => {
    const payload: SignalRequestWithUser = {
      signal_type: 'recommendation_accepted',
      user_id: 'user_abc',
      recommendation_id: 'rec_123',
      place_id: 'google:xyz',
    };

    it('forwards to POST /v1/signal with the enriched payload and 30s timeout', async () => {
      const body: SignalResponse = { status: 'accepted' };
      const response = { data: body } as AxiosResponse<SignalResponse>;
      httpService.post.mockReturnValueOnce(of(response));

      const result = await client.postSignal(payload);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:8000/v1/signal',
        payload,
        { timeout: 30000 }
      );
      expect(result).toEqual(body);
    });

    it('propagates upstream errors raw (so AllExceptionsFilter can translate 404)', async () => {
      const upstream = Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        response: { status: 404, data: { detail: 'Recommendation not found' } },
      });
      httpService.post.mockImplementationOnce(() => {
        throw upstream;
      });

      await expect(client.postSignal(payload)).rejects.toBe(upstream);
    });
  });

  describe('getUserContext()', () => {
    it('forwards to GET /v1/user/context with user_id as a query param', async () => {
      const body: AiUserContext = {
        saved_places_count: 3,
        signal_tier: 'active',
        chips: [
          {
            label: 'Japanese',
            source_field: 'subcategory',
            source_value: 'japanese',
            signal_count: 2,
            status: 'confirmed',
            selection_round: null,
          },
        ],
      };
      const response = { data: body } as AxiosResponse<AiUserContext>;
      httpService.get.mockReturnValueOnce(of(response));

      const result = await client.getUserContext('user_abc');

      expect(httpService.get).toHaveBeenCalledWith(
        'http://localhost:8000/v1/user/context',
        { params: { user_id: 'user_abc' }, timeout: 30000 }
      );
      expect(result).toEqual(body);
    });

    it('passes through a cold-start response unchanged', async () => {
      const body: AiUserContext = {
        saved_places_count: 0,
        signal_tier: 'cold',
        chips: [],
      };
      const response = { data: body } as AxiosResponse<AiUserContext>;
      httpService.get.mockReturnValueOnce(of(response));

      const result = await client.getUserContext('user_new');

      expect(result).toEqual(body);
    });
  });

  describe('deleteUserData()', () => {
    it('forwards to DELETE /v1/user/{user_id}/data with the user_id as a path param', async () => {
      const response = { data: undefined } as AxiosResponse<void>;
      (httpService.delete as jest.Mock).mockReturnValueOnce(of(response));

      await client.deleteUserData('user_abc');

      expect(httpService.delete).toHaveBeenCalledWith(
        'http://localhost:8000/v1/user/user_abc/data',
        { timeout: 30000 }
      );
    });

    it('URL-encodes user ids containing reserved characters', async () => {
      const response = { data: undefined } as AxiosResponse<void>;
      (httpService.delete as jest.Mock).mockReturnValueOnce(of(response));

      await client.deleteUserData('user/abc?x');

      expect(httpService.delete).toHaveBeenCalledWith(
        'http://localhost:8000/v1/user/user%2Fabc%3Fx/data',
        { timeout: 30000 }
      );
    });

    it('omits the query string when scopes is undefined or empty', async () => {
      const response = { data: undefined } as AxiosResponse<void>;
      (httpService.delete as jest.Mock).mockReturnValue(of(response));

      await client.deleteUserData('user_abc', undefined);
      await client.deleteUserData('user_abc', []);

      expect(httpService.delete).toHaveBeenNthCalledWith(
        1,
        'http://localhost:8000/v1/user/user_abc/data',
        { timeout: 30000 }
      );
      expect(httpService.delete).toHaveBeenNthCalledWith(
        2,
        'http://localhost:8000/v1/user/user_abc/data',
        { timeout: 30000 }
      );
    });

    it('serializes a single scope as ?scope=value', async () => {
      const response = { data: undefined } as AxiosResponse<void>;
      (httpService.delete as jest.Mock).mockReturnValueOnce(of(response));

      await client.deleteUserData('user_abc', ['chat_history']);

      expect(httpService.delete).toHaveBeenCalledWith(
        'http://localhost:8000/v1/user/user_abc/data?scope=chat_history',
        { timeout: 30000 }
      );
    });

    it('serializes multiple scopes as repeated ?scope= params', async () => {
      const response = { data: undefined } as AxiosResponse<void>;
      (httpService.delete as jest.Mock).mockReturnValueOnce(of(response));

      await client.deleteUserData('user_abc', ['chat_history', 'all']);

      expect(httpService.delete).toHaveBeenCalledWith(
        'http://localhost:8000/v1/user/user_abc/data?scope=chat_history&scope=all',
        { timeout: 30000 }
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

      await expect(client.deleteUserData('user_abc')).rejects.toBe(upstream);
    });
  });
});
