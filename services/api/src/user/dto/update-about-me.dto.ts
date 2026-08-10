import { IsISO31661Alpha2, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ABOUT_ME_MAX_LENGTH, CALL_ME_MAX_LENGTH } from '@kebi-app/shared';

/**
 * Client→gateway about-me write (kebi ADR-154). Both fields are optional and
 * nullable, and an omitted field is *not* a partial update — the block is
 * written whole, so a field the client leaves out is cleared. That keeps
 * "clearing" expressible without a sentinel: send `""` or `null`.
 *
 * `call_me` is stored with the rest of the block. It is the name kebi uses; the
 * account display name is left alone, and stands in when this is unset.
 */
export class UpdateAboutMeDto {
  /**
   * What kebi should call the user, capped as kebi caps it. Cleared → the
   * account display name stands in again, so the user is never left nameless.
   */
  @IsOptional()
  @Transform(({ value }) => blankToNull(value))
  @IsString()
  @MaxLength(CALL_ME_MAX_LENGTH)
  call_me?: string | null;

  /**
   * ISO 3166-1 alpha-2, normalized upper (`ae` → `AE`) before validation so the
   * case-insensitive inbound rule is ours too. A country name or an alpha-3 code
   * fails here, at our edge, rather than round-tripping to a kebi 422 — which is
   * why the client owes a country picker, not a text input.
   */
  @IsOptional()
  @Transform(({ value }) => blankToNull(value)?.toUpperCase() ?? null)
  @IsISO31661Alpha2()
  home_country?: string | null;

  /**
   * Free prose, capped at kebi's own limit. Whitespace-only is stored as `null`
   * so a cleared field never reaches the agent as a stated fact.
   */
  @IsOptional()
  @Transform(({ value }) => blankToNull(value))
  @IsString()
  @MaxLength(ABOUT_ME_MAX_LENGTH)
  about?: string | null;
}

/**
 * Trimmed string, or `null` for anything empty — the contract treats a
 * whitespace-only value as absent, and `@IsOptional()` then skips the remaining
 * validators for it, so `""` clears a field instead of failing it.
 */
function blankToNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
