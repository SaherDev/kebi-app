import { Readable } from 'stream';
import {
  AiUserContext,
  ChatRequestDto,
  DataScope,
  SignalRequestWithUser,
  SignalResponse,
} from '@kebi-app/shared';

/**
 * Interface for the AI service client
 * Abstracts HTTP communication with the AI service behind a clean contract
 *
 * ADR-036: Unified POST /v1/chat for all intent-bearing user input. Intent
 * classification is the AI service's responsibility, not NestJS's.
 *
 * ADR-033: Interface-first design — inject via IAiServiceClient, not the concrete class
 */
export interface IAiServiceClient {
  /**
   * Open a raw SSE stream to the AI service for a user message.
   * NestJS pipes the stream straight through to the client — no parsing,
   * no transformation. The frontend handles all SSE frame types directly.
   *
   * @param signal - AbortSignal to cancel the upstream request on client disconnect
   */
  chatStream(payload: ChatRequestDto, signal?: AbortSignal): Promise<Readable>;

  /**
   * Forward a user feedback signal to the AI service.
   * The caller has already injected user_id from the Clerk token.
   * Lets AxiosError propagate raw; AllExceptionsFilter handles 404 → 404 pass-through.
   */
  postSignal(payload: SignalRequestWithUser): Promise<SignalResponse>;

  /**
   * Fetch the user's taste-context summary from the AI service.
   * userId is forwarded as the `?user_id=…` query parameter per the FastAPI contract.
   */
  getUserContext(userId: string): Promise<AiUserContext>;

  /**
   * Delete AI-owned data for the user. With no `scopes` (or `["all"]`), wipes
   * places, embeddings, taste_model, recommendations, user_memories,
   * interactions, the LangGraph chat thread, and any pending taste-regen task.
   * `scopes=["chat_history"]` clears only the LangGraph thread and the
   * pending taste-regen task; SQL data is preserved. Scopes are forwarded as
   * repeated `?scope=` query params per the AI contract.
   */
  deleteUserData(userId: string, scopes?: DataScope[]): Promise<void>;
}

/**
 * Injection token for IAiServiceClient
 * Used with @Inject(AI_SERVICE_CLIENT) in NestJS services
 */
export const AI_SERVICE_CLIENT = Symbol('IAiServiceClient');
