import { z } from 'zod';
import type { ConsultResponseData } from '@kebi-app/shared';
import { PlaceObjectSchema } from '../../lib/place-schema';

const ReasoningStepSchema = z.object({
  step: z.string(),
  summary: z.string(),
});

const ConsultResultSchema = z.object({
  place: PlaceObjectSchema,
  source: z.enum(['saved', 'discovered']),
});

export const ConsultResponseDataSchema = z.object({
  recommendation_id: z.string().nullable(),
  results: z.array(ConsultResultSchema),
  reasoning_steps: z.array(ReasoningStepSchema),
}) satisfies z.ZodType<ConsultResponseData>;
