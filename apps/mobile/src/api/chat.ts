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
 * Body is exactly `{ message, location, local_time }`. `movement_profile` is
 * NEVER sent — the gateway injects it server-side from the verified token
 * (ADR-037). The caller passes the user's actual coordinates; kebi
 * reverse-geocodes them server-side (ADR-083), so lat/lng alone is enough for
 * geo-aware results. `local_time` is sent for the same reason the location is:
 * only the device knows the user's real clock, and the day of week is
 * load-bearing for kebi's schedule answers (kebi ADR-138).
 */

/** WGS-84 coordinates, or `null` when the user denied/lacked location. */
export interface ChatLocation {
  lat: number;
  lng: number;
}

/** The device's wall-clock time as ISO-8601 with its UTC offset. */
export function deviceLocalTime(now: Date): string {
  const offsetMin = -now.getTimezoneOffset();
  const sign = offsetMin < 0 ? '-' : '+';
  const abs = Math.abs(offsetMin);
  const pad = (n: number) => String(n).padStart(2, '0');
  const offset = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  const local = new Date(now.getTime() + offsetMin * 60_000);
  return `${local.toISOString().slice(0, 19)}${offset}`;
}

export async function* streamChat(
  client: HttpClient,
  message: string,
  location: ChatLocation | null,
  signal?: AbortSignal,
): AsyncIterable<SseEvent> {
  yield* client.postStream(
    API_ROUTES.chat,
    { message, location, local_time: deviceLocalTime(new Date()) },
    signal,
  );
}
