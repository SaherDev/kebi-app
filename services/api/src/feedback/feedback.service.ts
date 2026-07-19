import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { FeedbackResponse } from '@kebi-app/shared';
import { FeedbackRequestDto } from './dto/feedback-request.dto';
import { buildFeedbackPage, NOTION_VERSION } from './notion-page';

const NOTION_PAGES_URL = 'https://api.notion.com/v1/pages';
const HOUR_MS = 60 * 60 * 1000;

/**
 * Forwards feedback to a Notion database (ADR-051). Fire-and-forget: the user
 * always gets 202 — a missing Notion config or a Notion failure is logged,
 * never surfaced (a bug report must not fail because the triage tool is down).
 * A small per-user hourly cap guards the fan-out; state is in-memory
 * (process-local, resets on restart — acceptable for a single-instance gateway).
 */
@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);
  private readonly submissions = new Map<string, number[]>();
  private readonly maxPerHour: number;
  private readonly timeoutMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.maxPerHour = this.configService.get<number>('feedback.max_per_hour') ?? 5;
    this.timeoutMs = this.configService.get<number>('feedback.notion_timeout_ms') ?? 10000;
  }

  async submit(
    userId: string,
    email: string | undefined,
    dto: FeedbackRequestDto,
  ): Promise<FeedbackResponse> {
    this.assertUnderCap(userId);

    const token = this.secret('NOTION_FEEDBACK_TOKEN');
    const databaseId = this.secret('NOTION_FEEDBACK_DATABASE_ID');
    if (!token || !databaseId) {
      this.logger.warn('Notion feedback credentials not configured — report dropped');
      return { status: 'received' };
    }

    const body = buildFeedbackPage({ databaseId, userId, email, dto, now: new Date() });
    try {
      await firstValueFrom(
        this.httpService.post(NOTION_PAGES_URL, body, {
          timeout: this.timeoutMs,
          headers: {
            Authorization: `Bearer ${token}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json',
          },
        }),
      );
    } catch (error) {
      this.logger.error(
        `Forwarding feedback to Notion failed: ${error instanceof Error ? error.message : error}`,
      );
    }
    return { status: 'received' };
  }

  private assertUnderCap(userId: string): void {
    const now = Date.now();
    const fresh = (this.submissions.get(userId) ?? []).filter((at) => at > now - HOUR_MS);
    if (fresh.length >= this.maxPerHour) {
      throw new HttpException(
        { error: 'feedback_rate_limited', limit: this.maxPerHour },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    fresh.push(now);
    this.submissions.set(userId, fresh);
  }

  /** Env values load as '' when the key is present but blank — treat as unset. */
  private secret(key: string): string | undefined {
    const value = this.configService.get<string>(key);
    return value?.trim() ? value : undefined;
  }
}
