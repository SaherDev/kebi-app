import { IsNotEmpty, IsString } from 'class-validator';

/**
 * POST /v1/user/places body (api-contract.md) — the plain "save" on the place
 * screen (ADR-151). The place id is the whole body: identity is the verified
 * X-Gateway-User-Id header, `source` is server-stamped (kebi), and no
 * attribution rides along, since holding a `places.id` at all means kebi
 * surfaced the place.
 *
 * The retired card's `recommendation_id`/`reason` are gone — kebi rejects them
 * as unknown keys (422), so forwarding them would fail every save.
 */
export class SaveUserPlaceDto {
  @IsString()
  @IsNotEmpty()
  place_core_id!: string;
}
