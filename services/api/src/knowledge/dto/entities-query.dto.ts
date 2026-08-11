import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

/** Contract bounds for the typeahead term (api-contract.md). */
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 120;

/**
 * GET /v1/knowledge/entities query params (api-contract.md). `q` is **required**
 * — the endpoint is a typeahead, not a browse — and its 2–120 bound is enforced
 * here so a one-character keystroke fails as a 400 at our edge rather than
 * spending a kebi round-trip on every letter typed.
 *
 * Every contract param is declared so the global `whitelist: true` pipe does not
 * strip it before forwarding.
 */
export class EntitiesQueryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(MIN_QUERY_LENGTH)
  @MaxLength(MAX_QUERY_LENGTH)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
