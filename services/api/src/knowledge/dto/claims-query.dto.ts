import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * GET /v1/knowledge/claims query params (api-contract.md). Thin pass-through:
 * the gateway validates only structure and forwards verbatim. kebi owns the
 * cursor vocabulary — a malformed cursor surfaces as its 400.
 *
 * Every contract param is declared so the global `whitelist: true` pipe does not
 * strip it before forwarding. Ownership is the X-Gateway-User-Id header, never a
 * query field: these are global rows, and the caller may only list their own.
 */
export class ClaimsQueryDto {
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
