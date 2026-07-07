import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

/** Normalize a repeatable query param into an array (single value → [value]). */
const toArray = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null) return undefined;
  return Array.isArray(value) ? value : [value];
};

/**
 * GET /v1/user/library query params (api-contract.md). Thin pass-through: the
 * gateway validates only structure (sort enum, limit range, bool/int coercion)
 * and forwards the rest verbatim. kebi owns the strict 422 vocabulary — unknown
 * enum values and sort-mismatched cursors (400) surface from upstream.
 *
 * Every contract param is declared so the global `whitelist: true` pipe does
 * not strip it before forwarding. Identity is the X-Gateway-User-Id header,
 * never a query field.
 */
export class LibraryQueryDto {
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  category?: string[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  tag?: string[];

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  // kebi validates the PlaceSource enum value.
  @IsOptional()
  @IsString()
  source?: string;

  // Booleans are kept as the string literals the wire carries. The gateway only
  // forwards them (String(value)), and the pipe's `enableImplicitConversion`
  // would otherwise coerce "false" via Boolean() → true, inverting the filter.
  // Strings pass through untouched; kebi parses "true"/"false" itself.
  @IsOptional()
  @IsIn(['true', 'false'])
  visited?: 'true' | 'false';

  @IsOptional()
  @IsIn(['true', 'false'])
  liked?: 'true' | 'false';

  @IsOptional()
  @IsIn(['true', 'false'])
  approved?: 'true' | 'false';

  @IsOptional()
  @IsString()
  saved_after?: string;

  @IsOptional()
  @IsString()
  saved_before?: string;

  @IsOptional()
  @IsIn(['recent', 'name'])
  sort?: 'recent' | 'name';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}
