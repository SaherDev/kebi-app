import type { SseEvent } from '@kebi-app/shared';
import type { HttpClient } from './types';
import { API_ROUTES } from './routes';

/**
 * `POST /chat` — a conversational turn streamed as Server-Sent Events
 * (api-contract.md §POST /v1/chat/stream, ADR-036: one always-streaming chat
 * endpoint). Mirrors the call-module pattern in ./extract — a thin, typed seam
 * over the transport. Frames are validated inside the transport's SSE parser
 * (ADR-046), so this just yields them.
 *
 * Body is exactly `{ message, location }`. `movement_profile` is NEVER sent —
 * the gateway injects it server-side from the verified token (ADR-037). The
 * caller passes the user's actual coordinates; kebi reverse-geocodes them
 * server-side (ADR-083), so lat/lng alone is enough for geo-aware results.
 */

/** WGS-84 coordinates, or `null` when the user denied/lacked location. */
export interface ChatLocation {
  lat: number;
  lng: number;
}

export async function* streamChat(
  client: HttpClient,
  message: string,
  location: ChatLocation | null,
  signal?: AbortSignal,
): AsyncIterable<SseEvent> {
  yield* client.postStream(API_ROUTES.chat, { message, location }, signal);
}
