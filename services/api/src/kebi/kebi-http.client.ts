import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Readable } from 'stream';
import type { AxiosRequestConfig } from 'axios';

const KEBI_TIMEOUT_MS = 30000;

/**
 * Shared signed-HTTP transport to the kebi service. The single place that knows
 * the base URL, the timeout, and the service-to-service auth: every protected
 * call carries the shared-secret `X-Gateway-Token` plus the verified
 * `X-Gateway-User-Id`. kebi fails closed without them, so a missing
 * `GATEWAY_SHARED_SECRET` (or `KEBI_BASE_URL`) aborts startup.
 *
 * The per-domain clients (chat/signal/extract/user) compose this — they own only
 * their own URL/query shaping and never re-implement headers, timeout, or the
 * Axios → Promise plumbing. Lets AxiosError propagate raw; AllExceptionsFilter
 * translates it.
 */
@Injectable()
export class KebiHttpClient {
  private readonly logger = new Logger(KebiHttpClient.name);
  private readonly baseUrl: string;
  private readonly gatewaySecret: string;

  constructor(
    configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    const baseUrl = configService.get<string>('KEBI_BASE_URL');
    if (!baseUrl) {
      throw new Error('KEBI_BASE_URL is not configured');
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

  async get<T>(path: string, userId: string): Promise<T> {
    const response = await firstValueFrom(
      this.httpService.get<T>(this.url(path), this.config(userId)),
    );
    return response.data;
  }

  async post<T>(path: string, userId: string, body?: unknown): Promise<T> {
    const response = await firstValueFrom(
      this.httpService.post<T>(this.url(path), body, this.config(userId)),
    );
    return response.data;
  }

  async patch<T>(path: string, userId: string, body?: unknown): Promise<T> {
    const response = await firstValueFrom(
      this.httpService.patch<T>(this.url(path), body, this.config(userId)),
    );
    return response.data;
  }

  async delete<T = void>(path: string, userId: string): Promise<T> {
    const response = await firstValueFrom(
      this.httpService.delete<T>(this.url(path), this.config(userId)),
    );
    return response.data;
  }

  /**
   * Open a raw SSE stream (`responseType: 'stream'`) — the body is returned as a
   * Node.js Readable without buffering. `signal` aborts the upstream connection
   * on client disconnect.
   */
  async postStream(
    path: string,
    userId: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<Readable> {
    const response = await firstValueFrom(
      this.httpService.post<Readable>(
        this.url(path),
        body,
        this.config(userId, { responseType: 'stream', signal }),
      ),
    );
    return response.data;
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  /** Axios config with the gateway auth headers + timeout stamped on. */
  private config(
    userId: string,
    extra?: AxiosRequestConfig,
  ): AxiosRequestConfig {
    return {
      timeout: KEBI_TIMEOUT_MS,
      ...extra,
      headers: {
        'X-Gateway-Token': this.gatewaySecret,
        'X-Gateway-User-Id': userId,
        ...extra?.headers,
      },
    };
  }
}
