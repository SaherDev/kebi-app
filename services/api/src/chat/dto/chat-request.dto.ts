import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CHAT_LOCAL_TIME_MAX_LENGTH } from '@kebi-app/shared';

export class LocationDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;
}

/**
 * Client→gateway chat body. `movement_profile` is NOT a client field — the
 * gateway sources it from the verified Supabase token and injects it into the
 * kebi-bound body. Identity travels in the X-Gateway-User-Id header.
 */
export class ChatRequestBodyDto {
  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  /**
   * The caller's local wall-clock time, ISO-8601 with offset
   * (`2026-08-10T19:30:00+08:00`). Client-supplied for the same reason
   * `location` is — only the device knows the user's real clock, and day of
   * week is load-bearing for kebi's schedule answers (kebi ADR-138). Omitted →
   * kebi answers without a schedule rather than guessing one.
   */
  @IsOptional()
  @IsString()
  @MaxLength(CHAT_LOCAL_TIME_MAX_LENGTH)
  local_time?: string;
}
