import { IsArray, IsIn, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { DATA_SCOPES, type DataScope } from '@kebi-app/shared';

const ALLOWED_SCOPES: readonly string[] = DATA_SCOPES;

export class DeleteUserDataQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    return Array.isArray(value) ? value : [value];
  })
  @IsArray()
  @IsIn(ALLOWED_SCOPES, { each: true })
  scope?: DataScope[];
}
