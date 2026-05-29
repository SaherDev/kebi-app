import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import type { SignalType } from '@kebi-app/shared';

const ALLOWED_SIGNAL_TYPES: SignalType[] = [
  'recommendation_accepted',
  'recommendation_rejected',
];

/**
 * Recommendation accept/reject signal (kebi ADR-076/078). `place_core_id` is
 * kebi's `places.id`. Identity is the verified X-Gateway-User-Id header, never
 * a body field.
 */
export class SignalRequestDto {
  @IsIn(ALLOWED_SIGNAL_TYPES)
  signal_type!: SignalType;

  @IsString()
  @IsNotEmpty()
  recommendation_id!: string;

  @IsString()
  @IsNotEmpty()
  place_core_id!: string;
}
