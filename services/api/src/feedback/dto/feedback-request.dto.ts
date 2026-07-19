import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { FeedbackCategory, FeedbackKind } from '@kebi-app/shared';
import { FEEDBACK_CATEGORIES, FEEDBACK_KINDS } from '@kebi-app/shared';

// Size caps guard the Notion fan-out; the client truncates to the same limits.
const TEXT_MAX = 2000;
const TURN_TEXT_MAX = 500;
const TRANSCRIPT_MAX_TURNS = 40;
const TITLES_MAX = 20;

export class FeedbackExchangeDto {
  @IsString()
  @MaxLength(TURN_TEXT_MAX)
  you!: string;

  @IsString()
  @MaxLength(TURN_TEXT_MAX)
  kebi!: string;
}

export class FeedbackTranscriptTurnDto {
  @IsIn(['you', 'kebi'])
  role!: 'you' | 'kebi';

  @IsString()
  @MaxLength(TURN_TEXT_MAX)
  text!: string;

  @IsString()
  at!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TITLES_MAX)
  @IsString({ each: true })
  step_titles?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TITLES_MAX)
  @IsString({ each: true })
  tool_names?: string[];
}

/**
 * In-app feedback body (ADR-051). Identity is stamped server-side from the
 * verified token, never a body field. `wrong_answer` may arrive with only a
 * category (chip-only report); `bug` and `message` require text.
 */
export class FeedbackRequestDto {
  @IsIn(FEEDBACK_KINDS)
  kind!: FeedbackKind;

  @ValidateIf((o: FeedbackRequestDto) => o.kind !== 'wrong_answer' || o.text !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(TEXT_MAX)
  text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  input?: string;

  @IsOptional()
  @IsIn(FEEDBACK_CATEGORIES)
  category?: FeedbackCategory;

  @IsOptional()
  @ValidateNested()
  @Type(() => FeedbackExchangeDto)
  exchange?: FeedbackExchangeDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TRANSCRIPT_MAX_TURNS)
  @ValidateNested({ each: true })
  @Type(() => FeedbackTranscriptTurnDto)
  transcript?: FeedbackTranscriptTurnDto[];

  @IsOptional()
  @IsString()
  @MaxLength(32)
  app_version?: string;

  @IsOptional()
  @IsIn(['ios', 'android'])
  platform?: 'ios' | 'android';

  @IsOptional()
  @IsString()
  @MaxLength(32)
  os_version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  device?: string;
}
