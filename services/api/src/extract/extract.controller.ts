import { Body, Controller, Post } from '@nestjs/common';
import type { AuthUser, ExtractPlaceResponse } from '@kebi-app/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiresAi } from '../common/decorators/requires-ai.decorator';
import { ExtractRequestDto } from './dto/extract-request.dto';
import { ExtractService } from './extract.service';

/**
 * Canonical place-extraction endpoint (kebi ADR-073). Facade (ADR-032) — one
 * service call. Synchronous; a cold video URL can take ~60s on kebi's side.
 *
 * POST /api/v1/extract — requires a valid Clerk token + AI enabled.
 */
@Controller('extract')
export class ExtractController {
  constructor(private readonly extractService: ExtractService) {}

  @Post()
  @RequiresAi()
  async extract(
    @CurrentUser() user: AuthUser,
    @Body() dto: ExtractRequestDto
  ): Promise<ExtractPlaceResponse> {
    return this.extractService.extract(user.id, dto);
  }
}
