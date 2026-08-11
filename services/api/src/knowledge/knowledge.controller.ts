import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  AuthUser,
  CurateKnowledgeResponse,
  EntitySearchResponse,
  KnowledgeClaimsResponse,
} from '@kebi-app/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CuratorGuard } from '../common/guards/curator.guard';
import { CurateKnowledgeDto } from './dto/curate-knowledge-request.dto';
import { ClaimsQueryDto } from './dto/claims-query.dto';
import { EntitiesQueryDto } from './dto/entities-query.dto';
import { KnowledgeService } from './knowledge.service';

/**
 * Expert knowledge curation (ADR-121, entity anchors ADR-160). Facade (ADR-032)
 * — one service call per route.
 *
 * **Every** route here is gated by {@link CuratorGuard} at the controller level,
 * deliberately rather than per-method: these are global writes and reads of who
 * wrote what, so a route added later is gated by default instead of by whoever
 * remembers the decorator. Defense in depth — the guard denies at the edge from
 * the token's `can_curate` claim, and kebi independently 403s on
 * `X-Gateway-Can-Curate: false`.
 *
 * All routes require a valid Supabase token (AuthMiddleware) before the guard
 * runs, so an unauthenticated caller never reaches the role check.
 */
@Controller('knowledge')
@UseGuards(CuratorGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  /** POST /api/v1/knowledge/curate — write prose, get back the stored claims. */
  @Post('curate')
  async curate(
    @CurrentUser() user: AuthUser,
    @Body() dto: CurateKnowledgeDto,
  ): Promise<CurateKnowledgeResponse> {
    return this.knowledgeService.curate(user.id, dto, user.can_curate ?? false);
  }

  /** GET /api/v1/knowledge/claims — the caller's own claims, newest first. */
  @Get('claims')
  async listClaims(
    @CurrentUser() user: AuthUser,
    @Query() query: ClaimsQueryDto,
  ): Promise<KnowledgeClaimsResponse> {
    return this.knowledgeService.listClaims(user.id, query, user.can_curate ?? false);
  }

  /**
   * DELETE /api/v1/knowledge/claims/:claimId — retract one of your own.
   * 204 on success; a claim that isn't yours 404s exactly like one that doesn't
   * exist, so ids can't be probed.
   */
  @Delete('claims/:claimId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async retractClaim(
    @CurrentUser() user: AuthUser,
    @Param('claimId') claimId: string,
  ): Promise<void> {
    await this.knowledgeService.retractClaim(user.id, claimId, user.can_curate ?? false);
  }

  /** GET /api/v1/knowledge/entities — typeahead behind the anchor chip. */
  @Get('entities')
  async searchEntities(
    @CurrentUser() user: AuthUser,
    @Query() query: EntitiesQueryDto,
  ): Promise<EntitySearchResponse> {
    return this.knowledgeService.searchEntities(user.id, query, user.can_curate ?? false);
  }
}
