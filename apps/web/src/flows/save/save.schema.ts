import { z } from 'zod';
import type { ExtractPlaceItem, ExtractPlaceData } from '@kebi-app/shared';
import { PlaceObjectSchema } from '../../lib/place-schema';

export const ExtractPlaceItemSchema = z.object({
  place: PlaceObjectSchema.nullable(),
  confidence: z.number().nullable(),
  status: z.enum(['saved', 'needs_review', 'duplicate', 'pending', 'failed']),
}) satisfies z.ZodType<ExtractPlaceItem>;

export const ExtractPlaceDataSchema = z.object({
  results: z.array(ExtractPlaceItemSchema),
  source_url: z.string().nullable(),
  request_id: z.string().nullable(),
}) satisfies z.ZodType<ExtractPlaceData>;
