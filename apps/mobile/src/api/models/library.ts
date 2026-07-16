import { z } from 'zod';
import type {
  LibraryResponse as LibraryResponseContract,
  PlaceCore as PlaceCoreContract,
  PlaceNote as PlaceNoteContract,
  PlaceSource,
  SavedPlaceView as SavedPlaceViewContract,
  UserPlace as UserPlaceContract,
} from '@kebi-app/shared';
import { PlaceCoreSchema } from './place-core';

/**
 * Runtime models for the Library reads (api-contract.md §GET /v1/user/library,
 * §PATCH /v1/user/places/{id}). Same class+schema pattern as ./place-core and
 * ./extract: validate raw JSON at the boundary and `.transform()` into class
 * instances so components receive real domain objects (ADR-046).
 *
 * Forward-compatible (ADR-019): unknown keys stripped; `source` accepts any
 * string (kebi may add a `PlaceSource`) so a new value never breaks the client.
 */

export class UserPlace implements UserPlaceContract {
  readonly user_place_id: string;
  readonly place_id: string;
  readonly approved: boolean;
  readonly visited: boolean;
  readonly liked: boolean | null;
  readonly note: string | null;
  readonly source: PlaceSource;
  readonly source_ref: string | null;
  readonly source_label: string | null;
  readonly saved_at: string;
  readonly visited_at: string | null;

  constructor(p: UserPlaceContract) {
    this.user_place_id = p.user_place_id;
    this.place_id = p.place_id;
    this.approved = p.approved;
    this.visited = p.visited;
    this.liked = p.liked;
    this.note = p.note;
    this.source = p.source;
    this.source_ref = p.source_ref;
    this.source_label = p.source_label;
    this.saved_at = p.saved_at;
    this.visited_at = p.visited_at;
  }
}

export const UserPlaceSchema = z
  .object({
    user_place_id: z.string(),
    place_id: z.string(),
    approved: z.boolean(),
    visited: z.boolean(),
    liked: z.boolean().nullable(),
    note: z.string().nullable(),
    source: z.custom<PlaceSource>((v) => typeof v === 'string'),
    source_ref: z.string().nullable(),
    source_label: z.string().nullable(),
    saved_at: z.string(),
    visited_at: z.string().nullable(),
  })
  .transform((p) => new UserPlace(p));

export class PlaceNote implements PlaceNoteContract {
  readonly id: string;
  readonly text: string;
  readonly tags: string[];
  readonly source: 'community' | 'expert' | 'kebi';
  readonly from_shared: boolean;
  readonly agree_count: number;
  readonly disagree_count: number;

  constructor(p: PlaceNoteContract) {
    this.id = p.id;
    this.text = p.text;
    this.tags = p.tags;
    this.source = p.source;
    this.from_shared = p.from_shared;
    this.agree_count = p.agree_count;
    this.disagree_count = p.disagree_count;
  }
}

export const PlaceNoteSchema = z
  .object({
    id: z.string(),
    text: z.string(),
    tags: z.array(z.string()),
    // Tolerant (ADR-019): a new coarse-origin label never breaks the client.
    source: z.custom<PlaceNoteContract['source']>((v) => typeof v === 'string'),
    from_shared: z.boolean(),
    // 0 until the vote write-path ships; default guards a mid-rollout kebi.
    agree_count: z.number().nullish().transform((v) => v ?? 0),
    disagree_count: z.number().nullish().transform((v) => v ?? 0),
  })
  .transform((p) => new PlaceNote(p));

export class SavedPlaceView implements SavedPlaceViewContract {
  readonly place: PlaceCoreContract;
  readonly user_data: UserPlaceContract;
  readonly claims: PlaceNoteContract[];

  constructor(p: SavedPlaceViewContract) {
    this.place = p.place;
    this.user_data = p.user_data;
    this.claims = p.claims;
  }
}

export const SavedPlaceViewSchema = z
  .object({
    place: PlaceCoreSchema,
    user_data: UserPlaceSchema,
    // Rollout-tolerant: a pre-ADR-127 kebi omits `claims` → treat as none.
    claims: z
      .array(PlaceNoteSchema)
      .nullish()
      .transform((v) => v ?? []),
  })
  .transform((p) => new SavedPlaceView(p));

export class LibraryResponse implements LibraryResponseContract {
  readonly places: SavedPlaceViewContract[];
  readonly next_cursor: string | null;
  readonly total: number | null;

  constructor(p: LibraryResponseContract) {
    this.places = p.places;
    this.next_cursor = p.next_cursor;
    this.total = p.total;
  }
}

export const LibraryResponseSchema = z
  .object({
    places: z.array(SavedPlaceViewSchema),
    next_cursor: z.string().nullable(),
    // Tolerant: absent until kebi ships the field → treat as unknown (null).
    total: z.number().nullish().transform((v) => v ?? null),
  })
  .transform((p) => new LibraryResponse(p));
