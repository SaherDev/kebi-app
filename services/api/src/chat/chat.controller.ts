import { Controller, Post, Body, Res, Req, UseGuards } from '@nestjs/common';
import { IncomingMessage } from 'http';
import type { Response } from 'express';
import type { AuthUser } from '@kebi-app/shared';
import { ChatService } from './chat.service';
import { ChatRequestBodyDto } from './dto/chat-request.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiresAi } from '../common/decorators/requires-ai.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';

/**
 * Controller for the unified chat endpoint
 * Pure facade pattern (ADR-032) — makes exactly one service call
 *
 * POST /api/v1/chat
 * - Requires valid Clerk token (via AuthMiddleware)
 * - Requires AI enabled (via @RequiresAi() guard per ADR-022)
 * - Pipes raw SSE stream from the AI service to the client; NestJS is transparent
 */
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @RequiresAi()
  @UseGuards(RateLimitGuard)
  async chat(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChatRequestBodyDto,
    @Req() req: IncomingMessage,
    @Res() res: Response,
  ): Promise<void> {
    await this.chatService.pipeStream(user, dto, req, res);
  }
}
