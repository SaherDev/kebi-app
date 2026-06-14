import type { SseEvent } from '@kebi-app/shared';
import { z } from 'zod';
import { validate } from '../validate';
import {
  SseDoneSchema,
  SseErrorSchema,
  SseMessageSchema,
  SseReasoningStepSchema,
  SseToolResultSchema,
} from '../models/sse';

/**
 * Incremental Server-Sent Events parser for `POST /chat`
 * (api-contract.md → POST /v1/chat/stream). Pure and string-only — it never
 * touches `expo/fetch` or `TextDecoder`, so the byte→text decode stays in the
 * transport and this stays trivially unit-testable.
 *
 * Each complete frame is routed by its `event:` name to the matching Zod schema
 * in ../models/sse and validated at the boundary (ADR-046, fail-closed): a
 * malformed payload throws {@link SchemaValidationError} rather than reaching
 * the caller. Unknown event names are skipped (forward-compat, ADR-019).
 *
 * The parser is policy-free: it does NOT drop `visibility:"debug"` frames — that
 * render decision belongs to the transcript store, which owns all display rules.
 */

/** Per-event payload validators, keyed by SSE `event:` name. */
const FRAME_SCHEMAS = {
  reasoning_step: SseReasoningStepSchema,
  tool_result: SseToolResultSchema,
  message: SseMessageSchema,
  done: SseDoneSchema,
  error: SseErrorSchema,
} as const satisfies Record<SseEvent['type'], z.ZodTypeAny>;

type FrameType = keyof typeof FRAME_SCHEMAS;

function isFrameType(name: string): name is FrameType {
  return name in FRAME_SCHEMAS;
}

/** Validate a raw `data` JSON string for `type` into a typed {@link SseEvent}. */
function toEvent(type: FrameType, data: string): SseEvent {
  // Widen to a single schema type — indexing the map gives a union of the five
  // schemas, which `validate`'s generic can't unify; the cast below is sound
  // because each schema validates exactly its arm's payload.
  const schema: z.ZodTypeAny = FRAME_SCHEMAS[type];
  const parsed = validate(schema, JSON.parse(data), `Sse:${type}`);
  return { type, data: parsed } as SseEvent;
}

/**
 * Parse one complete SSE frame (its lines, no trailing blank line) into an
 * event, or `null` when the event name is unknown/absent. Concatenates multiple
 * `data:` lines with `\n` per the SSE spec; ignores comment lines (`:`-prefixed).
 */
function parseFrame(frame: string): SseEvent | null {
  let event: string | null = null;
  const dataLines: string[] = [];

  for (const rawLine of frame.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line === '' || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    // A single leading space after the colon is part of the SSE framing, not data.
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') dataLines.push(value);
  }

  if (event === null || !isFrameType(event) || dataLines.length === 0) return null;
  return toEvent(event, dataLines.join('\n'));
}

/** A stateful incremental parser; feed it raw text chunks as they arrive. */
export interface SseFrameParser {
  /** Append a chunk and emit every now-complete frame. */
  push(chunk: string): SseEvent[];
  /** Emit any trailing complete frame the buffer still holds at stream end. */
  flush(): SseEvent[];
}

/**
 * Create an {@link SseFrameParser}. Frames are separated by a blank line; the
 * trailing partial frame (a chunk that split a frame mid-flight) stays buffered
 * until the rest arrives.
 */
export function parseSseFrames(): SseFrameParser {
  let buffer = '';

  const drain = (final: boolean): SseEvent[] => {
    const events: SseEvent[] = [];
    // Normalise CRLF so a single split handles both line endings.
    buffer = buffer.replace(/\r\n/g, '\n');
    let sep = buffer.indexOf('\n\n');
    while (sep !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const event = parseFrame(frame);
      if (event) events.push(event);
      sep = buffer.indexOf('\n\n');
    }
    if (final && buffer.trim() !== '') {
      const event = parseFrame(buffer);
      if (event) events.push(event);
      buffer = '';
    }
    return events;
  };

  return {
    push(chunk: string): SseEvent[] {
      buffer += chunk;
      return drain(false);
    },
    flush(): SseEvent[] {
      return drain(true);
    },
  };
}
