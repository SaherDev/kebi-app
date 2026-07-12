import { IsString, IsNotEmpty, IsOptional, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** Max prose length accepted per curation (kebi structures it into claims). */
const MAX_CURATE_TEXT = 8000;

/**
 * Optional fallback geography for claims kebi can't geocode from the prose alone.
 * All fields optional — `whitelist: true` strips anything not declared here.
 */
export class CurateLocationHintDto {
  @IsOptional()
  @IsString()
  country_alpha2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;
}

/**
 * Client→gateway curation body (ADR-121). Identity travels in the
 * X-Gateway-User-Id header; the curator role is not a body field — the gateway
 * sources it from settings and forwards X-Gateway-Can-Curate.
 */
export class CurateKnowledgeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CURATE_TEXT)
  text!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CurateLocationHintDto)
  location_hint?: CurateLocationHintDto;
}
