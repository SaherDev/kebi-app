import { Injectable, Inject, Logger } from '@nestjs/common';
import { IncomingMessage } from 'http';
import type { Response } from 'express';
import type { AuthUser } from '@kebi-app/shared';
import {
  type IAiServiceClient,
  AI_SERVICE_CLIENT,
} from '../ai-service/ai-service-client.interface';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { ChatRequestBodyDto } from './dto/chat-request.dto';

/**
 * Service for handling chat requests
 * Pipes the raw SSE stream from the AI service straight through to the client.
 *
 * ADR-036: No routing logic, no response transformation.
 * ADR-032: Business logic lives here, not in the controller.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(AI_SERVICE_CLIENT) private readonly aiClient: IAiServiceClient,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async pipeStream(
    user: AuthUser,
    dto: ChatRequestBodyDto,
    req: IncomingMessage,
    res: Response,
  ): Promise<void> {
    this.rateLimitService.incrementTurns(user.id);

    const controller = new AbortController();

    const stream = await this.aiClient.chatStream(
      {
        message: dto.message,
        location: dto.location ?? null,
        movement_profile: user.movement_profile ?? null,
      },
      user.id,
      controller.signal,
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Abort the upstream FastAPI connection when the client disconnects.
    req.on('close', () => controller.abort());

    stream.on('error', (err) => {
      // Abort errors are expected when the client disconnects — suppress them.
      if (controller.signal.aborted) {
        return;
      }
      this.logger.error('AI service stream error', err);
      const detail = err instanceof Error && err.message ? err.message : 'AI service error';
      if (!res.headersSent) {
        res.status(503).end();
      } else {
        res.write(
          `event: error\ndata: ${JSON.stringify({ detail })}\n\n`,
        );
        res.end();
      }
    });

    stream.pipe(res);
  }
}
