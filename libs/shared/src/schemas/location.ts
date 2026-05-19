import { z } from 'zod';

/**
 * Client-side reverse-geocoded context attached to a {@link Location}.
 *
 * Best-effort metadata resolved in the browser (BigDataCloud) and sent to
 * the AI service as a reasoning/ranking hint. Every field is nullable
 * because provider coverage is uneven by region (e.g. `neighborhood` is
 * frequently `null` in Israel and smaller cities; `city`/`countryName`
 * are almost always present).
 */
export const LocationContextSchema = z.object({
  city: z.string().nullable(),
  neighborhood: z.string().nullable(),
  district: z.string().nullable(),
  countryCode: z.string().nullable(),
  countryName: z.string().nullable(),
});

export type LocationContext = z.infer<typeof LocationContextSchema>;

/**
 * Geographic coordinates in WGS 84 decimal degrees.
 * `lat` ∈ [-90, 90], `lng` ∈ [-180, 180].
 *
 * The frontend may legitimately have no location (user denied the
 * permission prompt, geolocation API unavailable, or the browser threw).
 * All contracts that carry a location therefore use `Location | null`.
 *
 * `context` is optional, best-effort enrichment attached client-side
 * before the request is sent. It is absent on legacy/raw coordinates and
 * `null` when reverse geocoding failed — consumers must tolerate both.
 */
export const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  context: LocationContextSchema.nullable().optional(),
});

export const LocationOrNullSchema = LocationSchema.nullable();

export type Location = z.infer<typeof LocationSchema>;
