import { IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * PATCH /v1/user/places/{id} body (api-contract.md). Partial — only changed
 * fields. Omitted ≠ null: `@IsOptional()` skips validation when a field is
 * `null` or absent, so an explicit `liked: null` / `note: null` forwards through
 * (clears the value) while an omitted field stays `undefined` and drops out of
 * the JSON sent upstream.
 *
 * Empty-body and unknown-field → 422 is delegated to kebi, which owns the
 * partial-patch semantics. Identity is the X-Gateway-User-Id header, never the
 * body.
 */
export class UpdateUserPlaceDto {
  @IsOptional()
  @IsBoolean()
  visited?: boolean;

  @IsOptional()
  @IsBoolean()
  liked?: boolean | null;

  @IsOptional()
  @IsBoolean()
  approved?: boolean;

  @IsOptional()
  @IsString()
  note?: string | null;
}
