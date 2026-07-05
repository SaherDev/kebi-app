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
   * Free text stored on the save — typically the recommendation's reason the
   * client is showing (not persisted server-side, so the client supplies it).
   * Applied only on create; omit or `null` for no note.
   */
  @IsOptional()
  @IsString()
  note?: string | null;
}
