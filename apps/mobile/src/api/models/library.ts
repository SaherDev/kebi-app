import { z } from 'zod';
import type {
  AreaHandle as AreaHandleContract,
  AreaHandleParent as AreaHandleParentContract,
  LibraryAreaCount as LibraryAreaCountContract,
  LibraryAreasResponse as LibraryAreasResponseContract,
  LibraryResponse as LibraryResponseContract,
  PlaceCore as PlaceCoreContract,
  PlaceNote as PlaceNoteContract,
  PlaceSource,
  PlaceView as PlaceViewContract,
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

/**
 * A place's area, as something tappable (ADR-165). `uri` is pre-composed and
 * opaque — handed to the link handler, never rebuilt from `key`, whose segments
 * are geo-registry provider ids since ADR-169. `country_code` is how a client
 * groups by country without reading the key.
 */
export class AreaHandle implements AreaHandleContract {
  readonly key: string;
  readonly name: string;
  readonly uri: string;
  readonly icon: string | null;
  readonly country_code: string | null;
  readonly parent: AreaHandleParentContract | null;

  constructor(p: AreaHandleContract) {
    this.key = p.key;
    this.name = p.name;
    this.uri = p.uri;
    this.icon = p.icon;
    this.country_code = p.country_code;
    this.parent = p.parent;
  }
}

const areaHandleShape = {
  key: z.string(),
  name: z.string(),
  uri: z.string(),
  icon: z.string().nullish().transform((v) => v ?? null),
  // Nullish for the rollout window before kebi's ADR-169 deploy; the callers
  // fall back to the key's `{cc}` head until then.
  country_code: z.string().nullish().transform((v) => v ?? null),
};

const AreaHandleParentSchema = z.object(areaHandleShape);

export const AreaHandleSchema = z
  .object({
    ...areaHandleShape,
    parent: AreaHandleParentSchema.nullish().transform((v) => v ?? null),
  })
  .transform((p) => new AreaHandle(p));

/**
 * Any catalog place the caller can open, saved or not (ADR-151). `user_data` is
 * `null` when the caller never saved it — the place screen's "offer save"
 * signal, and the reason every user-state affordance is absent there.
 * {@link SavedPlaceView} is the saved narrowing the Library returns.
 */
export class PlaceView implements PlaceViewContract {
  readonly place: PlaceCoreContract;
  readonly user_data: UserPlaceContract | null;
  readonly claims: PlaceNoteContract[];
  readonly area: AreaHandleContract | null;

  constructor(p: PlaceViewContract) {
    this.place = p.place;
    this.user_data = p.user_data;
    this.claims = p.claims;
    this.area = p.area;
  }
}

/**
 * The saved narrowing — the Library's entries. A sibling class rather than a
 * subclass narrowing `user_data`: re-declaring an inherited field needs TS's
 * `declare` modifier, which this app's Babel transform rejects.
 */
export class SavedPlaceView implements SavedPlaceViewContract {
  readonly place: PlaceCoreContract;
  readonly user_data: UserPlaceContract;
  readonly claims: PlaceNoteContract[];
  readonly area: AreaHandleContract | null;

  constructor(p: SavedPlaceViewContract) {
    this.place = p.place;
    this.user_data = p.user_data;
    this.claims = p.claims;
    this.area = p.area;
  }
}

const placeViewShape = {
  place: PlaceCoreSchema,
  // Rollout-tolerant: a pre-ADR-127 kebi omits `claims` → treat as none.
  claims: z
    .array(PlaceNoteSchema)
    .nullish()
    .transform((v) => v ?? []),
  // Null when the place's geography is coarser than a city (ADR-165) — the
  // "elsewhere" bucket. Absent on a pre-ADR-165 kebi, which reads the same.
  area: AreaHandleSchema.nullish().transform((v) => v ?? null),
};

export const SavedPlaceViewSchema = z
  .object({ ...placeViewShape, user_data: UserPlaceSchema })
  .transform((p) => new SavedPlaceView(p));

/** GET /v1/places/{id} — the same shape, with the save nullable. */
export const PlaceViewSchema = z
  .object({
    ...placeViewShape,
    // Absent and explicit-null both mean "not saved" — the offer-save signal.
    user_data: UserPlaceSchema.nullish().transform((v) => v ?? null),
  })
  .transform((p) => new PlaceView(p));

export class LibraryResponse implements LibraryResponseContract {
  readonly places: SavedPlaceViewContract[];
  readonly next_cursor: string | null;
  readonly total: number | null;
  readonly filtered_total: number | null;

  constructor(p: LibraryResponseContract) {
    this.places = p.places;
    this.next_cursor = p.next_cursor;
    this.total = p.total;
    this.filtered_total = p.filtered_total;
  }
}

export const LibraryResponseSchema = z
  .object({
    places: z.array(SavedPlaceViewSchema),
    next_cursor: z.string().nullable(),
    // Tolerant: absent until kebi ships the field → treat as unknown (null).
    total: z.number().nullish().transform((v) => v ?? null),
    // How many saves match `q` + filters across the whole library (ADR-164).
    filtered_total: z.number().nullish().transform((v) => v ?? null),
  })
  .transform((p) => new LibraryResponse(p));

/** One area the caller has saves in, with an exact whole-library count. */
export class LibraryAreaCount implements LibraryAreaCountContract {
  readonly area: AreaHandleContract;
  readonly count: number;

  constructor(p: LibraryAreaCountContract) {
    this.area = p.area;
    this.count = p.count;
  }
}

export class LibraryAreasResponse implements LibraryAreasResponseContract {
  readonly areas: LibraryAreaCountContract[];
  readonly unassigned_count: number | null;

  constructor(p: LibraryAreasResponseContract) {
    this.areas = p.areas;
    this.unassigned_count = p.unassigned_count;
  }
}

export const LibraryAreasResponseSchema = z
  .object({
    areas: z
      .array(
        z
          .object({ area: AreaHandleSchema, count: z.number() })
          .transform((p) => new LibraryAreaCount(p)),
      )
      .nullish()
      .transform((v) => v ?? []),
    // `null` (not 0) when absent: a mid-rollout kebi that never sends the field
    // is not claiming every save resolved, and 0 would silence the bucket.
    unassigned_count: z.number().nullish().transform((v) => v ?? null),
  })
  .transform((p) => new LibraryAreasResponse(p));
