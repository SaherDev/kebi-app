import { Injectable, Logger } from '@nestjs/common';
import { IncomingMessage } from 'http';
import type { Response } from 'express';
import type { AuthUser, ChatRequestDto, NormalizedIdentity } from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { ChatRequestBodyDto } from './dto/chat-request.dto';
import { ChatUserProfileFactory } from './chat-user-profile.factory';

/**
 * Service for handling chat requests
 * Pipes the raw SSE stream from the AI service straight through to the client.
 *
 * Byte-transparent by design: the gateway never parses frames, so frame types
 * kebi adds (`reasoning_delta`, `message_delta`, …) reach the client with no
 * change here. What it does own is DELIVERY — no buffering, no coalescing, no
 * timeout — so a token written upstream is a token rendered on the device.
 *
 * ADR-036: No routing logic, no response transformation.
 * ADR-032: Business logic lives here, not in the controller.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly kebi: KebiHttpClient,
    private readonly rateLimitService: RateLimitService,
    private readonly userProfileFactory: ChatUserProfileFactory,
  ) {}

  async pipeStream(
    identity: NormalizedIdentity,
    user: AuthUser,
    dto: ChatRequestBodyDto,
    req: IncomingMessage,
    res: Response,
  ): Promise<void> {
    this.rateLimitService.incrementTurns(user.id);

    const controller = new AbortController();

    const payload: ChatRequestDto = {
      message: dto.message,
      location: dto.location ?? null,
      local_time: dto.local_time ?? null,
      movement_profile: user.movement_profile ?? null,
      user_profile: this.userProfileFactory.from(identity, user),
    };
    const stream = await this.kebi.postStream(
      '/v1/chat/stream',
      user.id,
      payload,
      controller.signal,
      user.plan,
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Reverse proxies buffer a response body by default, which would hold token
    // frames back and deliver the turn in bursts — the exact thing streaming
    // exists to avoid. Nginx-family proxies honour this opt-out.
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Frames are tiny and latency-sensitive; Nagle would sit on each one waiting
    // for company, so ship every write immediately.
    res.socket?.setNoDelay(true);

    // Abort the upstream FastAPI connection when the client disconnects — which
    // is also how "stop" works: the app aborts its request mid-stream, this
    // fires, and kebi stops generating instead of finishing into a dead socket.
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
