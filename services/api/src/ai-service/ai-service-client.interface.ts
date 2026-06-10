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

  /**
   * Read the caller's saved-place library (`GET /v1/user/library`). `query` is
   * the validated filter/sort/paging params, forwarded verbatim as the upstream
   * query string (repeated `category`/`tag` become repeated params). kebi owns
   * the strict vocabulary — a bad enum value or sort-mismatched cursor surfaces
   * as a raw 422/400 for AllExceptionsFilter to translate.
   */
  getUserLibrary(
    query: Record<string, string | string[]>,
    userId: string,
  ): Promise<LibraryResponse>;

  /**
   * Update one save's user-state (`PATCH /v1/user/places/{id}`). Partial body —
   * omitted ≠ null. Returns the full updated user-state. A 404 (no such save or
   * not owned) propagates raw.
   */
  updateUserPlace(
    userPlaceId: string,
    body: UpdateUserPlaceRequest,
    userId: string,
  ): Promise<LibraryUserData>;

  /**
   * Remove one save from the caller's library (`DELETE /v1/user/places/{id}`).
   * 204 on success; a 404 (absent or not owned) propagates raw.
   */
  deleteUserPlace(userPlaceId: string, userId: string): Promise<void>;
}

/**
 * Injection token for IAiServiceClient
 * Used with @Inject(AI_SERVICE_CLIENT) in NestJS services
 */
export const AI_SERVICE_CLIENT = Symbol('IAiServiceClient');
