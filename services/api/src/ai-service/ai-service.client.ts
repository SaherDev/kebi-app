import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Readable } from 'stream';
import {
  ChatRequestDto,
  DataScope,
  ExtractPlaceRequest,
  ExtractPlaceResponse,
  LibraryResponse,
  LibraryUserData,
  SignalRequest,
  SignalResponse,
  UpdateUserPlaceRequest,
} from '@kebi-app/shared';
import { IAiServiceClient } from './ai-service-client.interface';

const AI_SERVICE_TIMEOUT_MS = 30000;

/**
 * HTTP client for communicating with the AI service (kebi).
 *
 * Service-to-service auth: every protected call carries the shared-secret
 * `X-Gateway-Token` plus the verified `X-Gateway-User-Id`. kebi fails closed
 * without them, so a missing `GATEWAY_SHARED_SECRET` aborts startup.
 *
 * ADR-036: chatStream() pipes raw SSE from FastAPI straight through —
 * responseType: 'stream' keeps Axios out of the data path. Lets AxiosError
 * propagate raw; AllExceptionsFilter handles translation to HTTP errors.
 * ADR-033: Injected via IAiServiceClient interface, not this class directly.
 */
@Injectable()
export class AiServiceClient implements IAiServiceClient {
  private readonly logger = new Logger(AiServiceClient.name);
  private readonly baseUrl: string;
  private readonly gatewaySecret: string;

  constructor(
    configService: ConfigService,
    private readonly httpService: HttpService
  ) {
    const baseUrl = configService.get<string>('AI_SERVICE_BASE_URL');
    if (!baseUrl) {
      throw new Error('AI_SERVICE_BASE_URL is not configured');
    }
    this.baseUrl = baseUrl;

    const gatewaySecret = configService.get<string>('GATEWAY_SHARED_SECRET');
    if (!gatewaySecret) {
      // Fail closed — kebi rejects every protected call without this header,
      // and it must match kebi's GATEWAY_SHARED_SECRET byte-for-byte.
      throw new Error('GATEWAY_SHARED_SECRET is not configured');
    }
    this.gatewaySecret = gatewaySecret;

    this.logger.debug(`Initialized with base URL: ${this.baseUrl}`);
  }

  /** Service-to-service auth headers kebi requires on every protected route. */
  private gatewayHeaders(userId: string): Record<string, string> {
    return {
      'X-Gateway-Token': this.gatewaySecret,
      'X-Gateway-User-Id': userId,
    };
  }

  /**
   * Open a raw SSE stream to the AI service at /v1/chat/stream.
   * responseType: 'stream' returns the body as a Node.js Readable without
   * buffering. `signal` aborts the upstream connection on client disconnect.
   * Lets AxiosError propagate raw to callers.
   */
  async chatStream(
    payload: ChatRequestDto,
    userId: string,
    signal?: AbortSignal
  ): Promise<Readable> {
    const response = await firstValueFrom(
      this.httpService.post<Readable>(
        `${this.baseUrl}/v1/chat/stream`,
        payload,
        {
          responseType: 'stream',
          timeout: AI_SERVICE_TIMEOUT_MS,
          signal,
          headers: this.gatewayHeaders(userId),
        }
      )
    );
    return response.data;
  }

  async postSignal(
    payload: SignalRequest,
    userId: string
  ): Promise<SignalResponse> {
    const response = await firstValueFrom(
      this.httpService.post<SignalResponse>(
        `${this.baseUrl}/v1/signal`,
        payload,
        { timeout: AI_SERVICE_TIMEOUT_MS, headers: this.gatewayHeaders(userId) }
      )
    );
    return response.data;
  }

  async extractPlace(
    payload: ExtractPlaceRequest,
    userId: string
  ): Promise<ExtractPlaceResponse> {
    const response = await firstValueFrom(
      this.httpService.post<ExtractPlaceResponse>(
        `${this.baseUrl}/v1/extract`,
        payload,
        { timeout: AI_SERVICE_TIMEOUT_MS, headers: this.gatewayHeaders(userId) }
      )
    );
    return response.data;
  }

  async deleteUserData(userId: string, scopes?: DataScope[]): Promise<void> {
    let url = `${this.baseUrl}/v1/user/data`;
    if (scopes && scopes.length > 0) {
      const qs = new URLSearchParams();
      for (const scope of scopes) qs.append('scope', scope);
      url += `?${qs.toString()}`;
    }
    await firstValueFrom(
      this.httpService.delete<void>(url, {
        timeout: AI_SERVICE_TIMEOUT_MS,
        headers: this.gatewayHeaders(userId),
      })
    );
  }

  async getUserLibrary(
    query: Record<string, string | string[]>,
    userId: string
  ): Promise<LibraryResponse> {
    let url = `${this.baseUrl}/v1/user/library`;
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        for (const v of value) qs.append(key, v);
      } else {
        qs.append(key, value);
      }
    }
    const queryString = qs.toString();
    if (queryString) url += `?${queryString}`;

    const response = await firstValueFrom(
      this.httpService.get<LibraryResponse>(url, {
        timeout: AI_SERVICE_TIMEOUT_MS,
        headers: this.gatewayHeaders(userId),
      })
    );
    return response.data;
  }

  async updateUserPlace(
    userPlaceId: string,
    body: UpdateUserPlaceRequest,
    userId: string
  ): Promise<LibraryUserData> {
    const response = await firstValueFrom(
      this.httpService.patch<LibraryUserData>(
        `${this.baseUrl}/v1/user/places/${encodeURIComponent(userPlaceId)}`,
        body,
        { timeout: AI_SERVICE_TIMEOUT_MS, headers: this.gatewayHeaders(userId) }
      )
    );
    return response.data;
  }

  async deleteUserPlace(userPlaceId: string, userId: string): Promise<void> {
    await firstValueFrom(
      this.httpService.delete<void>(
        `${this.baseUrl}/v1/user/places/${encodeURIComponent(userPlaceId)}`,
        { timeout: AI_SERVICE_TIMEOUT_MS, headers: this.gatewayHeaders(userId) }
      )
    );
  }
}
