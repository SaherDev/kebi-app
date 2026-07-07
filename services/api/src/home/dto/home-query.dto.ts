import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * GET /v1/home query params (api-contract.md, ADR-111). All optional. Thin
 * pass-through: the gateway validates only structure (lat/lng range + numeric
 * coercion) and forwards the rest verbatim. kebi owns the strict vocabulary and
 * fails open, so loose values never break the screen.
 *
 * Every contract param is declared so the global `whitelist: true` pipe does not
 * strip it before forwarding. Identity is the X-Gateway-User-Id header, never a
 * query field — the server never originates location.
 */
export class HomeQueryDto {
  // Used only to reverse-geocode a city when `city` is absent; the −90..90 /
  // −180..180 ranges mirror the contract (out-of-range → 422).
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @IsString()
  city?: string;

  // ISO-8601 device local time; kebi derives the daypart. Forwarded as-is.
  @IsOptional()
  @IsString()
  local_time?: string;

  @IsOptional()
  @IsString()
  weather?: string;
}
