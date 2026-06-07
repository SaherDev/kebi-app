import { z } from 'zod';
import type {
  ExtractPlaceResponse as ExtractPlaceResponseContract,
  ExtractPlaceResult as ExtractPlaceResultContract,
  ExtractStatus,
  PlaceCore as PlaceCoreContract,
} from '@kebi-app/shared';
import { PlaceCoreSchema } from './place-core';

/**
 * Runtime models for `POST /v1/extract` (api-contract.md, ADR-073). Same
 * class+schema pattern as ./place-core. `results` is non-empty iff
 * `status === "completed"`; `failure_*` are populated only when `status ===
 * "failed"` — both are envelope facts the caller inspects, not enforced here.
 */

export class ExtractPlaceResult implements ExtractPlaceResultContract {
  readonly place: PlaceCoreContract;
  readonly confidence: number;

  constructor(p: ExtractPlaceResultContract) {
    this.place = p.place;
    this.confidence = p.confidence;
  }
}

export const ExtractPlaceResultSchema = z
  .object({
    place: PlaceCoreSchema,
    confidence: z.number(),
  })
  .transform((p) => new ExtractPlaceResult(p));

export class ExtractPlaceResponse implements ExtractPlaceResponseContract {
  readonly status: ExtractStatus;
  readonly results: ExtractPlaceResultContract[];
  readonly raw_input: string | null;
  readonly request_id: string | null;
  readonly failure_reason: string | null;
  readonly failure_message: string | null;

  constructor(p: ExtractPlaceResponseContract) {
    this.status = p.status;
    this.results = p.results;
    this.raw_input = p.raw_input;
    this.request_id = p.request_id;
    this.failure_reason = p.failure_reason;
    this.failure_message = p.failure_message;
  }
}

export const ExtractPlaceResponseSchema = z
  .object({
    status: z.enum(['pending', 'completed', 'failed']),
    results: z.array(ExtractPlaceResultSchema),
    raw_input: z.string().nullable(),
    request_id: z.string().nullable(),
    failure_reason: z.string().nullable(),
    failure_message: z.string().nullable(),
  })
  .transform((p) => new ExtractPlaceResponse(p));
