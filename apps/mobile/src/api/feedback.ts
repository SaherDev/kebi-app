import type { FeedbackRequest } from '@kebi-app/shared';
import type { HttpClient } from './types';
import { API_ROUTES } from './routes';

/**
 * `POST /api/v1/feedback` — an in-app feedback report (ADR-051). Thin function
 * over the injected {@link HttpClient}, mirroring ./signal. Identity is
 * stamped server-side from the verified token — never a body field.
 *
 * The gateway returns `202 { status: "received" }` and forwards to Notion
 * fire-and-forget; the client doesn't use the body, so this resolves `void`.
 * Transport errors surface as `HttpError` (e.g. the 429 hourly cap) for the
 * caller's error toast.
 */
export async function sendFeedback(
  client: HttpClient,
  body: FeedbackRequest,
  signal?: AbortSignal,
): Promise<void> {
  await client.post(API_ROUTES.feedback, body, signal);
}
