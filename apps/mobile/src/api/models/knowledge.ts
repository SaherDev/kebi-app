import { z } from 'zod';
import type {
  CurateAnchor,
  CurateClaim as CurateClaimContract,
  CurateKnowledgeResponse as CurateKnowledgeResponseContract,
  CurateScope,
  ClaimAnchor as ClaimAnchorContract,
  EntitySearchResult as EntitySearchResultContract,
  KnowledgeClaim as KnowledgeClaimContract,
  KnowledgeClaimsResponse as KnowledgeClaimsResponseContract,
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

/**
 * One hit in the anchor typeahead. The populated id field **is** the anchor
 * payload — it goes into a curate `anchor` verbatim, and the two kinds are not
 * interchangeable: a venue carries the catalog `place_id`, an area the encoded
 * token (its raw geo key is not a valid anchor).
 */
export class EntityHit implements EntitySearchResultContract {
  readonly type: 'place' | 'area';
  readonly place_id: string | null;
  readonly area_id: string | null;
  readonly name: string;
  readonly level: string | null;
  readonly icon: string | null;
  readonly context: string;

  constructor(e: EntitySearchResultContract) {
    this.type = e.type;
    this.place_id = e.place_id;
    this.area_id = e.area_id;
    this.name = e.name;
    this.level = e.level;
    this.icon = e.icon;
    this.context = e.context;
  }

  /** The anchor this hit resolves to, or `null` if the id it needs is missing. */
  get anchor(): CurateAnchor | null {
    if (this.type === 'place') return this.place_id ? { place_id: this.place_id } : null;
    return this.area_id ? { area_id: this.area_id } : null;
  }

  /**
   * Glyph for the row. `icon` is nullable by design (kebi ADR-146 — LLM-less
   * paths leave it unset), so areas fall back to a map and places to a pin
   * rather than rendering an empty slot.
   */
  get emoji(): string {
    return this.icon ?? (this.type === 'area' ? '🗺️' : '📍');
  }

  /** Secondary line: an area names its level, a place its surroundings. */
  get subtitle(): string {
    return this.level ? `${this.level} · ${this.context}` : this.context;
  }
}

const EntityHitSchema = z
  .object({
    type: z.enum(['place', 'area']),
    place_id: z.string().nullable().default(null),
    area_id: z.string().nullable().default(null),
    name: z.string(),
    level: z.string().nullable().default(null),
    icon: z.string().nullable().default(null),
    context: z.string().default(''),
  })
  .transform((e) => new EntityHit(e));

export const EntitySearchSchema = z
  .object({ results: z.array(EntityHitSchema).default([]) })
  .transform((r) => r.results);

/**
 * A listed claim's anchor — renderable *and* openable. `type` says which id is
 * populated; the other is null.
 */
export class ClaimAnchor implements ClaimAnchorContract {
  readonly type: 'place' | 'area';
  readonly place_id: string | null;
  readonly area_id: string | null;
  readonly name: string;

  constructor(a: ClaimAnchorContract) {
    this.type = a.type;
    this.place_id = a.place_id;
    this.area_id = a.area_id;
    this.name = a.name;
  }

  /**
   * Stable identity for grouping. Kinds are separate id spaces, so the pair is
   * the key — never the id alone. Falls back to the name so an anchor missing
   * its id still groups with itself rather than collapsing every such claim
   * into one bucket.
   */
  get groupKey(): string {
    return `${this.type}:${this.place_id ?? this.area_id ?? this.name}`;
  }

  get emoji(): string {
    return this.type === 'area' ? '🗺️' : '📍';
  }
}

const ClaimAnchorSchema = z
  .object({
    type: z.enum(['place', 'area']),
    place_id: z.string().nullable().default(null),
    area_id: z.string().nullable().default(null),
    name: z.string(),
  })
  .transform((a) => new ClaimAnchor(a));

/** One of the caller's own curated claims — what backs "what you've added". */
export class KnowledgeClaim implements KnowledgeClaimContract {
  readonly id: string;
  readonly scope: CurateScope;
  readonly claim: string;
  readonly tags: string[];
  readonly created_at: string;
  readonly anchor: ClaimAnchor;

  constructor(c: KnowledgeClaimContract & { anchor: ClaimAnchor }) {
    this.id = c.id;
    this.scope = c.scope;
    this.claim = c.claim;
    this.tags = c.tags;
    this.created_at = c.created_at;
    this.anchor = c.anchor;
  }
}

const KnowledgeClaimSchema = z
  .object({
    id: z.string(),
    scope: z.enum(CURATE_SCOPES),
    claim: z.string(),
    tags: z.array(z.string()).default([]),
    created_at: z.string(),
    anchor: ClaimAnchorSchema,
  })
  .transform((c) => new KnowledgeClaim(c));

export class KnowledgeClaimsPage implements KnowledgeClaimsResponseContract {
  readonly claims: KnowledgeClaim[];
  readonly next_cursor: string | null;

  constructor(p: { claims: KnowledgeClaim[]; next_cursor: string | null }) {
    this.claims = p.claims;
    this.next_cursor = p.next_cursor;
  }
}

export const KnowledgeClaimsSchema = z
  .object({
    claims: z.array(KnowledgeClaimSchema).default([]),
    next_cursor: z.string().nullable().default(null),
  })
  .transform((p) => new KnowledgeClaimsPage(p));

/** One anchor and everything the caller wrote about it. */
export interface ClaimGroup {
  key: string;
  anchor: ClaimAnchor;
  claims: KnowledgeClaim[];
}

/**
 * Group a page of claims by what they are about, in first-appearance order.
 *
 * Grouped rather than chronological because **one paragraph becomes several
 * claims**: a flat newest-first list scatters a single sitting down the page and
 * you never recognise your own writing. The server already orders newest-first,
 * so first-appearance order keeps recent subjects on top.
 */
export function groupClaimsByAnchor(claims: KnowledgeClaim[]): ClaimGroup[] {
  const groups: ClaimGroup[] = [];
  const seen = new Map<string, number>();
  for (const claim of claims) {
    const key = claim.anchor.groupKey;
    let at = seen.get(key);
    if (at === undefined) {
      at = groups.length;
      seen.set(key, at);
      groups.push({ key, anchor: claim.anchor, claims: [] });
    }
    groups[at].claims.push(claim);
  }
  return groups;
}
