import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * PATCH /user/profile body. Sets the user's display name (Supabase
 * `user_metadata.name`). Gateway-local — not forwarded to kebi. Identity is the
 * verified token, never the body.
 */
export class UpdateUserProfileDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;
}
