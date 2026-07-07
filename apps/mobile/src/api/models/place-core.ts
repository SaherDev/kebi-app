import { z } from 'zod';
import type {
  PlaceCategory,
  PlaceCore as PlaceCoreContract,
  PlaceCoreLocation as PlaceCoreLocationContract,
  PlaceNameAlias as PlaceNameAliasContract,
  PlaceTag as PlaceTagContract,
} from '@kebi-app/shared';

/**
 * Runtime models for the canonical `PlaceCore` shape and its leaves
 * (api-contract.md → Shared Types). Each is a class that `implements` the
 * `@kebi-app/shared` interface — mirroring the `TokenClaims` precedent
 * (services/api/src/auth/token-claims.ts): a validated response carries real
 * domain objects, not plain bags. The paired `*Schema` validates raw JSON and
 * `.transform()`s it into the class, so composition cascades — a parent schema
 * receives already-instantiated children.
 *
 * Forward-compatible (ADR-019): unknown keys are stripped, not rejected, and
 * `categories`/`tags` values accept any string (kebi types them as
 * `LiteralUnion`/free-text), so a new vocabulary value never breaks the client.
 */

export class PlaceNameAlias implements PlaceNameAliasContract {
  readonly value: string;
  readonly source: string;

  constructor(p: PlaceNameAliasContract) {
    this.value = p.value;
    this.source = p.source;
  }
}

export const PlaceNameAliasSchema = z
  .object({
    value: z.string(),
    source: z.string(),
  })
  .transform((p) => new PlaceNameAlias(p));

export class PlaceTag implements PlaceTagContract {
  readonly type: string;
  readonly value: string;
  readonly source: string;

  constructor(p: PlaceTagContract) {
    this.type = p.type;
    this.value = p.value;
    this.source = p.source;
  }
}

export const PlaceTagSchema = z
  .object({
    type: z.string(),
    value: z.string(),
    source: z.string(),
  })
  .transform((p) => new PlaceTag(p));

export class PlaceCoreLocation implements PlaceCoreLocationContract {
  readonly lat: number | null;
  readonly lng: number | null;
  readonly address: string | null;
  readonly neighborhood: string | null;
  readonly city: string | null;
  readonly country: string | null;

  constructor(p: PlaceCoreLocationContract) {
    this.lat = p.lat;
    this.lng = p.lng;
    this.address = p.address;
    this.neighborhood = p.neighborhood;
    this.city = p.city;
    this.country = p.country;
  }
}

export const PlaceCoreLocationSchema = z
  .object({
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    address: z.string().nullable(),
    neighborhood: z.string().nullable(),
    city: z.string().nullable(),
    country: z.string().nullable(),
  })
  .transform((p) => new PlaceCoreLocation(p));

export class PlaceCore implements PlaceCoreContract {
  readonly id: string | null;
  readonly provider_id: string | null;
  readonly place_name: string;
  readonly place_name_aliases: PlaceNameAliasContract[];
  readonly categories: PlaceCategory[];
  readonly tags: PlaceTagContract[];
  readonly icon: string | null;
  readonly location: PlaceCoreLocationContract | null;
  readonly created_at: string | null;
  readonly refreshed_at: string | null;

  constructor(p: PlaceCoreContract) {
    this.id = p.id;
    this.provider_id = p.provider_id;
    this.place_name = p.place_name;
    this.place_name_aliases = p.place_name_aliases;
    this.categories = p.categories;
    this.tags = p.tags;
    this.icon = p.icon;
    this.location = p.location;
    this.created_at = p.created_at;
    this.refreshed_at = p.refreshed_at;
  }
}

export const PlaceCoreSchema = z
  .object({
    id: z.string().nullable(),
    provider_id: z.string().nullable(),
    place_name: z.string(),
    place_name_aliases: z.array(PlaceNameAliasSchema),
    // kebi's PlaceCategory is a strict enum, but accept any string for
    // forward-compat; `z.custom` keeps the contract's `PlaceCategory` type.
    categories: z.array(z.custom<PlaceCategory>((v) => typeof v === 'string')),
    tags: z.array(PlaceTagSchema),
    // LLM-picked place emoji (ADR-117). Missing key → null (rollout window
    // before kebi emits it), same stance as LibraryResponse.total.
    icon: z.string().nullable().default(null),
    location: PlaceCoreLocationSchema.nullable(),
    created_at: z.string().nullable(),
    refreshed_at: z.string().nullable(),
  })
  .transform((p) => new PlaceCore(p));
