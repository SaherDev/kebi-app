import { z } from 'zod';
import type {
  IntentItem as IntentItemContract,
  IntentsResponse as IntentsResponseContract,
} from '@kebi-app/shared';

/**
 * Runtime models for the "what you wanted" recall list (api-contract.md §GET
 * /v1/user/intents, ADR-110). Same class+schema pattern as ./library. `created_at`
 * stays a raw ISO string — only the client knows the user's timezone, so relative
 * phrasing is rendered in the UI (lib/format-relative-time), not parsed here.
 */

export class IntentItem implements IntentItemContract {
  readonly id: string;
  readonly text: string;
  readonly created_at: string;

  constructor(p: IntentItemContract) {
    this.id = p.id;
    this.text = p.text;
    this.created_at = p.created_at;
  }
}

export const IntentItemSchema = z
  .object({
    id: z.string(),
    text: z.string(),
    created_at: z.string(),
  })
  .transform((p) => new IntentItem(p));

export class IntentsResponse implements IntentsResponseContract {
  readonly intents: IntentItemContract[];
  readonly next_cursor: string | null;

  constructor(p: IntentsResponseContract) {
    this.intents = p.intents;
    this.next_cursor = p.next_cursor;
  }
}

export const IntentsResponseSchema = z
  .object({
    intents: z.array(IntentItemSchema),
    next_cursor: z.string().nullable(),
  })
  .transform((p) => new IntentsResponse(p));
