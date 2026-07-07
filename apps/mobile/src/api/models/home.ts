import { z } from 'zod';
import type {
  HomeChip as HomeChipContract,
  HomeResponse as HomeResponseContract,
} from '@kebi-app/shared';

/**
 * Runtime models for the home opening surface (api-contract.md §GET /v1/home,
 * ADR-111). Same class+schema pattern as ./library: validate raw JSON at the
 * boundary and `.transform()` into class instances (ADR-046). Unknown keys are
 * stripped (forward-compatible, ADR-019). The endpoint fails open server-side,
 * so this shape always arrives; the client adds its own offline fallback.
 */

export class HomeChip implements HomeChipContract {
  readonly text: string;

  constructor(p: HomeChipContract) {
    this.text = p.text;
  }
}

export const HomeChipSchema = z
  .object({ text: z.string() })
  .transform((p) => new HomeChip(p));

export class HomeResponse implements HomeResponseContract {
  readonly greeting: string;
  readonly chips: HomeChipContract[];

  constructor(p: HomeResponseContract) {
    this.greeting = p.greeting;
    this.chips = p.chips;
  }
}

export const HomeResponseSchema = z
  .object({
    greeting: z.string(),
    chips: z.array(HomeChipSchema),
  })
  .transform((p) => new HomeResponse(p));
