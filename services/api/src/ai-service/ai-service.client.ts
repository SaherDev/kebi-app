import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Readable } from 'stream';
import {
  AiUserContext,
  ChatRequestDto,
  DataScope,
  SignalRequestWithUser,
  SignalResponse,
} from '@kebi-app/shared';
import { IAiServiceClient } from './ai-service-client.interface';

const AI_SERVICE_TIMEOUT_MS = 30000;

/**
 * HTTP client for communicating with the AI service (kebi)
 *
 * ADR-036: Single chatStream() method — pipes raw SSE from FastAPI straight through.
 * No parsing, no transformation. responseType: 'stream' keeps Axios out of the data path.
 * Lets AxiosError propagate raw; AllExceptionsFilter handles translation to HTTP errors.
 *
 * ADR-033: Injected via IAiServiceClient interface, not this class directly
 */
@Injectable()
export class AiServiceClient implements IAiServiceClient {
  private readonly logger = new Logger(AiServiceClient.name);
  private readonly baseUrl: string;

  constructor(
    configService: ConfigService,
    private readonly httpService: HttpService
  ) {
    this.baseUrl = configService.get<string>('AI_SERVICE_BASE_URL');
    if (!this.baseUrl) {
      throw new Error('AI_SERVICE_BASE_URL is not configured');
    }

    this.logger.debug(`Initialized with base URL: ${this.baseUrl}`);
  }

  /**
   * Open a raw SSE stream to the AI service at /v1/chat/stream.
   * Uses responseType: 'stream' so Axios returns the body as a Node.js Readable
   * without buffering or parsing. Passing signal aborts the upstream connection
   * when the client disconnects. Lets AxiosError propagate raw to callers.
   */
  async chatStream(payload: ChatRequestDto, signal?: AbortSignal): Promise<Readable> {
    const response = await firstValueFrom(
      this.httpService.post<Readable>(
        `${this.baseUrl}/v1/chat/stream`,
        payload,
        { responseType: 'stream', timeout: AI_SERVICE_TIMEOUT_MS, signal }
      )
    );
    return response.data;
  }

  async postSignal(payload: SignalRequestWithUser): Promise<SignalResponse> {
    const response = await firstValueFrom(
      this.httpService.post<SignalResponse>(
        `${this.baseUrl}/v1/signal`,
        payload,
        { timeout: AI_SERVICE_TIMEOUT_MS }
      )
    );
    return response.data;
  }

  async getUserContext(userId: string): Promise<AiUserContext> {
    const response = await firstValueFrom(
      this.httpService.get<AiUserContext>(
        `${this.baseUrl}/v1/user/context`,
        { params: { user_id: userId }, timeout: AI_SERVICE_TIMEOUT_MS }
      )
    );
    return response.data;
  }

  async deleteUserData(userId: string, scopes?: DataScope[]): Promise<void> {
    let url = `${this.baseUrl}/v1/user/${encodeURIComponent(userId)}/data`;
    if (scopes && scopes.length > 0) {
      const qs = new URLSearchParams();
      for (const scope of scopes) qs.append('scope', scope);
      url += `?${qs.toString()}`;
    }
    await firstValueFrom(
      this.httpService.delete<void>(url, { timeout: AI_SERVICE_TIMEOUT_MS })
    );
  }
}
