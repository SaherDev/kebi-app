import { z } from 'zod';
import type {
  AreaBreadcrumbItem as AreaBreadcrumbItemContract,
  AreaChip as AreaChipContract,
  AreaScreenView as AreaScreenViewContract,
  AreaSection as AreaSectionContract,
  AreaSubArea as AreaSubAreaContract,
  AreaVenueRow as AreaVenueRowContract,
} from '@kebi-app/shared';

/**
 * Runtime models for the area screen (api-contract.md §GET /v1/areas/{id},
 * kebi ADR-153). Same class+schema pattern as ./library and ./place-core:
 * validate raw JSON at the boundary and `.transform()` into class instances so
 * components receive real domain objects (ADR-046).
 *
 * Forward-compatible (ADR-019): unknown keys are stripped, and every field the
 * profiler fills is nullable — a thin first open (`profiled: false`) is a
 * normal response, not a malformed one.
 */

export class AreaChip implements AreaChipContract {
  readonly icon: string | null;
  readonly text: string;

  constructor(p: AreaChipContract) {
    this.icon = p.icon;
    this.text = p.text;
  }
}

export const AreaChipSchema = z
  .object({
    icon: z.string().nullable().default(null),
    text: z.string(),
  })
  .transform((p) => new AreaChip(p));

export class AreaBreadcrumbItem implements AreaBreadcrumbItemContract {
  readonly key: string;
  readonly name: string;
  readonly uri: string;

  constructor(p: AreaBreadcrumbItemContract) {
    this.key = p.key;
    this.name = p.name;
    this.uri = p.uri;
  }
}

export const AreaBreadcrumbItemSchema = z
  .object({
    key: z.string(),
    name: z.string(),
    uri: z.string(),
  })
  .transform((p) => new AreaBreadcrumbItem(p));

export class AreaSubArea implements AreaSubAreaContract {
  readonly key: string;
  readonly name: string;
  readonly uri: string;
  readonly icon: string | null;
  readonly hook: string | null;
  readonly saved_count: number;

  constructor(p: AreaSubAreaContract) {
    this.key = p.key;
    this.name = p.name;
    this.uri = p.uri;
    this.icon = p.icon;
    this.hook = p.hook;
    this.saved_count = p.saved_count;
  }
}

export const AreaSubAreaSchema = z
  .object({
    key: z.string(),
    name: z.string(),
    uri: z.string(),
    icon: z.string().nullable().default(null),
    hook: z.string().nullable().default(null),
    saved_count: z.number().default(0),
  })
  .transform((p) => new AreaSubArea(p));

export class AreaVenueRow implements AreaVenueRowContract {
  readonly id: string;
  readonly name: string;
  readonly uri: string;
  readonly icon: string | null;
  readonly subtitle: string | null;
  readonly liked: boolean | null;
  readonly visited: boolean;

  constructor(p: AreaVenueRowContract) {
    this.id = p.id;
    this.name = p.name;
    this.uri = p.uri;
    this.icon = p.icon;
    this.subtitle = p.subtitle;
    this.liked = p.liked;
    this.visited = p.visited;
  }
}

export const AreaVenueRowSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    uri: z.string(),
    icon: z.string().nullable().default(null),
    subtitle: z.string().nullable().default(null),
    liked: z.boolean().nullable().default(null),
    visited: z.boolean().default(false),
  })
  .transform((p) => new AreaVenueRow(p));

export class AreaSection implements AreaSectionContract {
  readonly kind: 'saved' | 'worth_knowing';
  readonly areas: AreaSubAreaContract[];
  readonly places: AreaVenueRowContract[];

  constructor(p: AreaSectionContract) {
    this.kind = p.kind;
    this.areas = p.areas;
    this.places = p.places;
  }
}

/**
 * Nothing to draw. kebi sends a section whenever it has one to send, but a
 * `saved` section can arrive with both lists empty, and a section header over
 * no rows is worse than no section.
 *
 * A free function rather than a method on {@link AreaSection}: nested fields
 * are declared at their contract types throughout these models, so a method
 * would only be reachable through a model-typed field and force the class type
 * to leak into every component signature.
 */
export function isSectionEmpty(section: AreaSectionContract): boolean {
  return section.areas.length === 0 && section.places.length === 0;
}

export const AreaSectionSchema = z
  .object({
    kind: z.enum(['saved', 'worth_knowing']),
    areas: z.array(AreaSubAreaSchema).default([]),
    places: z.array(AreaVenueRowSchema).default([]),
  })
  .transform((p) => new AreaSection(p));

export class AreaScreenView implements AreaScreenViewContract {
  readonly key: string;
  readonly uri: string;
  readonly name: string;
  readonly level: string | null;
  readonly icon: string | null;
  readonly summary: string | null;
  readonly best_for: AreaChipContract[];
  readonly breadcrumb: AreaBreadcrumbItemContract[];
  readonly saved_count: number;
  readonly profiled: boolean;
  readonly section: AreaSectionContract | null;

  constructor(p: AreaScreenViewContract) {
    this.key = p.key;
    this.uri = p.uri;
    this.name = p.name;
    this.level = p.level;
    this.icon = p.icon;
    this.summary = p.summary;
    this.best_for = p.best_for;
    this.breadcrumb = p.breadcrumb;
    this.saved_count = p.saved_count;
    this.profiled = p.profiled;
    this.section = p.section;
  }
}

export const AreaScreenViewSchema = z
  .object({
    key: z.string(),
    uri: z.string(),
    name: z.string(),
    // Everything the profiler fills is absent on a thin first open.
    level: z.string().nullable().default(null),
    icon: z.string().nullable().default(null),
    summary: z.string().nullable().default(null),
    best_for: z.array(AreaChipSchema).default([]),
    breadcrumb: z.array(AreaBreadcrumbItemSchema).default([]),
    saved_count: z.number().default(0),
    profiled: z.boolean().default(false),
    section: AreaSectionSchema.nullable().default(null),
  })
  .transform((p) => new AreaScreenView(p));
