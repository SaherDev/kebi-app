import { z } from 'zod';
import type {
  PlaceObject,
  PlaceAttributes,
  PlaceHours,
  PlaceLocationContext,
} from '@kebi-app/shared';

const PlaceLocationContextSchema: z.ZodType<PlaceLocationContext> = z.object({
  neighborhood: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
});

const PlaceAttributesSchema: z.ZodType<PlaceAttributes> = z.object({
  cuisine: z.string().nullable(),
  price_hint: z.string().nullable(),
  ambiance: z.string().nullable(),
  dietary: z.array(z.string()),
  good_for: z.array(z.string()),
  location_context: PlaceLocationContextSchema.nullable(),
});

const PlaceHoursSchema: z.ZodType<PlaceHours> = z.object({
  sunday: z.string().nullable().optional(),
  monday: z.string().nullable().optional(),
  tuesday: z.string().nullable().optional(),
  wednesday: z.string().nullable().optional(),
  thursday: z.string().nullable().optional(),
  friday: z.string().nullable().optional(),
  saturday: z.string().nullable().optional(),
  timezone: z.string(),
});

export const PlaceObjectSchema: z.ZodType<PlaceObject> = z.object({
  // Tier 1
  place_id: z.string(),
  place_name: z.string(),
  place_type: z.enum([
    'food_and_drink',
    'things_to_do',
    'shopping',
    'services',
    'accommodation',
  ]),
  subcategory: z.string().nullable(),
  tags: z.array(z.string()),
  attributes: PlaceAttributesSchema,
  source_url: z.string().nullable(),
  source: z
    .enum(['tiktok', 'instagram', 'youtube', 'google_maps', 'manual'])
    .nullable(),
  provider_id: z.string().nullable(),
  created_at: z.string().nullable(),

  // Tier 2
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  address: z.string().nullable(),
  geo_fresh: z.boolean(),

  // Tier 3
  hours: PlaceHoursSchema.nullable(),
  rating: z.number().nullable(),
  phone: z.string().nullable(),
  photo_url: z.string().nullable(),
  popularity: z.number().nullable(),
  enriched: z.boolean(),
});
