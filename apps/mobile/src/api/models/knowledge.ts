import { z } from 'zod';
import type {
  CurateClaim as CurateClaimContract,
  CurateKnowledgeResponse as CurateKnowledgeResponseContract,
  CurateScope,
} from '@kebi-app/shared';

/**
 * Runtime models for insider curation (POST /knowledge/curate). Same
 * class+schema pattern as ./profile: validate raw JSON at the boundary and
 * `.transform()` into a class instance (ADR-046).
 */

/** Claim scopes, mirroring the shared `CurateScope` union (kept in lockstep). */
const CURATE_SCOPES = [
  'place',
  'country',
  'city',
  'neighborhood',
] as const satisfies readonly CurateScope[];

export class CurateClaim implements CurateClaimContract {
  readonly id: string;
  readonly scope: CurateScope;
  readonly entity_name: string;
  readonly claim: string;
  readonly tags: string[];

  constructor(c: CurateClaimContract) {
    this.id = c.id;
    this.scope = c.scope;
    this.entity_name = c.entity_name;
    this.claim = c.claim;
    this.tags = c.tags;
  }
}

const CurateClaimSchema = z
  .object({
    id: z.string(),
    scope: z.enum(CURATE_SCOPES),
    entity_name: z.string(),
    claim: z.string(),
    tags: z.array(z.string()).default([]),
  })
  .transform((c) => new CurateClaim(c));

/**
 * What came back from a write. `claims_written` counts **new** rows only —
 * dedup collapses a re-submission and unkeyable/accessibility claims are
 * dropped, so it can be lower than the prose implied, and zero is a legitimate
 * outcome the toast has to be able to say.
 */
export class CurateResult implements CurateKnowledgeResponseContract {
  readonly claims_written: number;
  readonly claims: CurateClaim[];

  constructor(r: { claims_written: number; claims: CurateClaim[] }) {
    this.claims_written = r.claims_written;
    this.claims = r.claims;
  }

  /** True when kebi stored nothing — the prose was a dupe or unusable. */
  get storedNothing(): boolean {
    return this.claims_written === 0;
  }
}

export const CurateResultSchema = z
  .object({
    claims_written: z.number(),
    claims: z.array(CurateClaimSchema).default([]),
  })
  .transform((r) => new CurateResult(r));
