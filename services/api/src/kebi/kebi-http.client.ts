import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Readable } from 'stream';
import type { AxiosRequestConfig } from 'axios';
import type { PlanTier } from '@kebi-app/shared';
import { EntitlementsService } from '../entitlements/entitlements.service';

const KEBI_TIMEOUT_MS = 30000;

/** ADR-112 capability headers — the gateway forwards capabilities, never the plan name. */
const ENTITLEMENT_HEADERS = {
  taste: 'X-Gateway-Taste-Enabled',
  discovery: 'X-Gateway-Discovery-Enabled',
  advancedModels: 'X-Gateway-Advanced-Models-Enabled',
  saveLimit: 'X-Gateway-Save-Limit',
  consultsPerDay: 'X-Gateway-Consults-Per-Day',
} as const;

/** ADR-121 curator role — a per-user grant, not a plan entitlement. */
const CAN_CURATE_HEADER = 'X-Gateway-Can-Curate';

/** Per-user role capabilities sourced from settings (not plan). Fail-closed on kebi's side. */
export interface GatewayCapabilities {
  canCurate?: boolean;
}

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
    private readonly entitlements: EntitlementsService,
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

  async post<T>(
    path: string,
    userId: string,
    body?: unknown,
    plan?: PlanTier,
    capabilities?: GatewayCapabilities,
  ): Promise<T> {
    const response = await firstValueFrom(
      this.httpService.post<T>(this.url(path), body, this.config(userId, plan, capabilities)),
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
    plan?: PlanTier,
  ): Promise<Readable> {
    const response = await firstValueFrom(
      this.httpService.post<Readable>(
        this.url(path),
        body,
        this.config(userId, plan, undefined, { responseType: 'stream', signal }),
      ),
    );
    return response.data;
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  /**
   * Axios config with the gateway auth headers + timeout stamped on. When a
   * `plan` is supplied, the caller's ADR-112 capability headers ride along too.
   */
  private config(
    userId: string,
    plan?: PlanTier,
    capabilities?: GatewayCapabilities,
    extra?: AxiosRequestConfig,
  ): AxiosRequestConfig {
    return {
      timeout: KEBI_TIMEOUT_MS,
      ...extra,
      headers: {
        'X-Gateway-Token': this.gatewaySecret,
        'X-Gateway-User-Id': userId,
        ...this.entitlementHeaders(plan),
        ...this.capabilityHeaders(capabilities),
        ...extra?.headers,
      },
    };
  }

  /**
   * Per-user role headers (ADR-121). `X-Gateway-Can-Curate` is sent as an explicit
   * `"true"`/`"false"` whenever a capability set is supplied — kebi fails closed, so
   * an omitted set (all non-curate calls) sends nothing.
   */
  private capabilityHeaders(capabilities?: GatewayCapabilities): Record<string, string> {
    if (capabilities?.canCurate === undefined) return {};
    return { [CAN_CURATE_HEADER]: String(capabilities.canCurate) };
  }

  /**
   * ADR-112 capability headers for the caller's plan. Booleans are always sent
   * (kebi fails closed on a missing flag); numeric limits are omitted when null
   * (absent = unlimited), so kebi never hard-codes free-tier numbers. Returns an
   * empty set when no plan is supplied (non-entitlement-gated calls).
   */
  private entitlementHeaders(plan?: PlanTier): Record<string, string> {
    if (plan === undefined) return {};
    const ent = this.entitlements.resolve(plan);
    const headers: Record<string, string> = {
      [ENTITLEMENT_HEADERS.taste]: String(ent.taste_enabled),
      [ENTITLEMENT_HEADERS.discovery]: String(ent.discovery_enabled),
      [ENTITLEMENT_HEADERS.advancedModels]: String(ent.advanced_models_enabled),
    };
    if (ent.save_limit !== null) {
      headers[ENTITLEMENT_HEADERS.saveLimit] = String(ent.save_limit);
    }
    if (ent.consults_per_day !== null) {
      headers[ENTITLEMENT_HEADERS.consultsPerDay] = String(ent.consults_per_day);
    }
    return headers;
  }
}
