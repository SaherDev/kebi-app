import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { AuthUser, CurateKnowledgeResponse } from '@kebi-app/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CuratorGuard } from '../common/guards/curator.guard';
import { CurateKnowledgeDto } from './dto/curate-knowledge-request.dto';
import { KnowledgeService } from './knowledge.service';

/**
 * Expert knowledge curation (ADR-121). Facade (ADR-032) — one service call.
 * Gated by CuratorGuard (edge check on the token's curator role) and enforced
 * again by kebi via X-Gateway-Can-Curate.
 *
 * POST /api/v1/knowledge/curate — requires a valid Supabase token (AuthMiddleware).
 */
@Controller('knowledge')
@UseGuards(CuratorGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('curate')
  async curate(
    @CurrentUser() user: AuthUser,
    @Body() dto: CurateKnowledgeDto,
  ): Promise<CurateKnowledgeResponse> {
    return this.knowledgeService.curate(user.id, dto, user.can_curate ?? false);
  }
}
