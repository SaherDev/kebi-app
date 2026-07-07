import { IsString, IsNotEmpty, IsOptional, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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
}
