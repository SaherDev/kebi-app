import { ArrayNotEmpty, ArrayUnique, IsIn, IsOptional } from 'class-validator';
import { MOVEMENT_MODES, REACH_VALUES } from '@kebi-app/shared';
import type { MovementMode, Reach } from '@kebi-app/shared';

/**
 * Client→gateway movement write. A body reaching here means a human chose these
 * modes, which is what earns the row `source: 'user'` (kebi ADR-155) — the
 * service stamps it, never the client, so the claim can't be asserted on a
 * profile nobody picked.
 *
 * `available_modes` is a capability (licence, owned vehicles, comfort), not
 * per-city availability, so an empty list is meaningless and rejected.
 */
export class UpdateMovementProfileDto {
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(MOVEMENT_MODES, { each: true })
  available_modes!: MovementMode[];

  @IsOptional()
  @IsIn(REACH_VALUES)
  reach?: Reach;
}
