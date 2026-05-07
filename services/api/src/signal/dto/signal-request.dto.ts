import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { ChipStatus, SignalType } from '@kebi-app/shared';

const ALLOWED_SIGNAL_TYPES: SignalType[] = [
  'recommendation_accepted',
  'recommendation_rejected',
  'chip_confirm',
];

const ALLOWED_CHIP_STATUSES: ChipStatus[] = ['confirmed', 'rejected'];

export class ChipConfirmItemDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  source_field!: string;

  @IsString()
  @IsNotEmpty()
  source_value!: string;

  @IsInt()
  signal_count!: number;

  @IsIn(ALLOWED_CHIP_STATUSES)
  status!: Exclude<ChipStatus, 'pending'>;

  @IsString()
  @IsNotEmpty()
  selection_round!: string;
}

export class SignalMetadataDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChipConfirmItemDto)
  chips!: ChipConfirmItemDto[];
}

export class SignalRequestDto {
  @IsIn(ALLOWED_SIGNAL_TYPES)
  signal_type!: SignalType;

  @IsString()
  @IsNotEmpty()
  @ValidateIf(o => o.signal_type !== 'chip_confirm')
  recommendation_id?: string;

  @IsString()
  @IsNotEmpty()
  @ValidateIf(o => o.signal_type !== 'chip_confirm')
  place_id?: string;

  @ValidateIf(o => o.signal_type === 'chip_confirm')
  @ValidateNested()
  @Type(() => SignalMetadataDto)
  metadata?: SignalMetadataDto;
}
