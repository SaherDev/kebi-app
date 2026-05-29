import { Readable } from 'stream';
import {
  ChatRequestDto,
  DataScope,
  ExtractPlaceRequest,
  ExtractPlaceResponse,
  SignalRequest,
  SignalResponse,
} from '@kebi-app/shared';

/**
 * Interface for the AI service client.
 * Abstracts HTTP communication with kebi behind a clean contract.
 *
 * Every method targets a protected kebi route and therefore takes the verified
 * `userId` — the client forwards it as the `X-Gateway-User-Id` header (plus the
 * shared-secret `X-Gateway-Token`). `user_id` is never a body field.
 *
 * ADR-033: Interface-first design — inject via IAiServiceClient, not the
 * concrete class.
 */
export interface IAiServiceClient {
  /**
   * Open a raw SSE stream to kebi (`POST /v1/chat/stream`). NestJS pipes it
   * straight through to the client — no parsing, no transformation.
   *
   * @param signal - AbortSignal to cancel the upstream request on client disconnect
   */
  chatStream(
    payload: ChatRequestDto,
    userId: string,
    signal?: AbortSignal,
  ): Promise<Readable>;

  /**
   * Forward a recommendation accept/reject signal to kebi (`POST /v1/signal`).
   * Lets AxiosError propagate raw; AllExceptionsFilter translates it.
   */
  postSignal(payload: SignalRequest, userId: string): Promise<SignalResponse>;

  /**
   * Run the canonical extraction pipeline for a saved place
   * (`POST /v1/extract`). Synchronous on kebi's side; can take up to ~60s on a
   * cold video URL.
   */
  extractPlace(
    payload: ExtractPlaceRequest,
    userId: string,
  ): Promise<ExtractPlaceResponse>;

  /**
   * Delete AI-owned data for the caller (`DELETE /v1/user/data`). No `scopes`
   * (or `["all"]`) wipes everything; `["chat_history"]` clears only the
   * LangGraph thread + pending taste-regen. Scopes are forwarded as repeated
   * `?scope=` query params. The target user is the verified X-Gateway-User-Id.
   */
  deleteUserData(userId: string, scopes?: DataScope[]): Promise<void>;
}

/**
 * Injection token for IAiServiceClient
 * Used with @Inject(AI_SERVICE_CLIENT) in NestJS services
 */
export const AI_SERVICE_CLIENT = Symbol('IAiServiceClient');
