import { IsString, IsNotEmpty, IsOptional, IsNumber, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { SignalTier } from '@kebi-app/shared';

const ALLOWED_SIGNAL_TIERS: SignalTier[] = ['cold', 'warming', 'chip_selection', 'active'];

export class LocationDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}

export class ChatRequestBodyDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @IsOptional()
  @IsIn(ALLOWED_SIGNAL_TIERS)
  signal_tier?: SignalTier;
}
