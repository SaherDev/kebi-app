import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * GET /v1/user/intents query params (api-contract.md, ADR-110). Both optional.
 * Thin pass-through: the gateway validates only structure (limit range + int
 * coercion) and forwards verbatim. kebi owns the strict vocabulary — a malformed
 * cursor surfaces as a 400 from upstream.
 *
 * Identity is the X-Gateway-User-Id header, never a query field, so a caller can
 * only ever read their own intents.
 */
export class IntentsQueryDto {
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
