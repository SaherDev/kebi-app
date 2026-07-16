import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * POST /v1/user/places body (api-contract.md). Save a place kebi recommended to
 * the caller's library — the consult card's "save it" action. Identity is the
 * verified X-Gateway-User-Id header, never a body field; `source` is
 * server-stamped (kebi).
 */
export class SaveUserPlaceDto {
  @IsString()
  @IsNotEmpty()
  place_core_id!: string;

  @IsString()
  @IsNotEmpty()
  recommendation_id!: string;

  /**
   * The pick's rationale the card is showing — the client supplies it since the
   * reason isn't otherwise stored server-side. kebi writes it as a `kebi_message`
   * claim on the place (ADR-127), not as `user_data.note`. Omit or `null` for none.
   */
  @IsOptional()
  @IsString()
  reason?: string | null;
}
