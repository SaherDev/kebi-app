import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Request body for POST /api/v1/extract → kebi POST /v1/extract.
 * `raw_input` is a URL (TikTok / Instagram / YouTube / Google Maps list) or a
 * plain place name. Capped at 8000 chars to match kebi's boundary.
 */
export class ExtractRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  raw_input!: string;
}
