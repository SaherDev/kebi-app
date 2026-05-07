/**
 * Phase 1 contract snapshot — NOT compiled.
 * Reference shape for the post-change IAiServiceClient interface.
 * Actual source lives at services/api/src/ai-service/ai-service-client.interface.ts.
 */

import type {
  ChatRequestDto,
  ChatResponseDto,
  SignalRequestWithUser,
  SignalResponse,
  UserContextResponse,
} from '@kebi-app/shared';

/**
 * Interface for the AI service client.
 * ADR-033: Interface-first. Consumers inject via the AI_SERVICE_CLIENT token,
 * never the concrete class.
 * ADR-036: All AI forwarding goes through this single abstraction.
 */
export interface IAiServiceClient {
  /** Existing — POST /v1/chat (30s timeout). */
  chat(payload: ChatRequestDto): Promise<ChatResponseDto>;

  /**
   * NEW — POST /v1/signal.
   * The caller passes a payload already enriched with user_id.
   * Lets AxiosError propagate raw; AllExceptionsFilter handles 404 → 404 pass-through.
   */
  postSignal(payload: SignalRequestWithUser): Promise<SignalResponse>;

  /**
   * NEW — GET /v1/user/context?user_id=<clerkId>.
   * userId is the Clerk user ID, injected by the calling service.
   */
  getUserContext(userId: string): Promise<UserContextResponse>;
}

/** Injection token — unchanged. */
export const AI_SERVICE_CLIENT: unique symbol;
