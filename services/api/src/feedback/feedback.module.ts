import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

// HttpService is injected directly — KebiHttpClient is kebi-only (ADR-047)
// and feedback goes to Notion, never to kebi (ADR-051).
@Module({
  imports: [HttpModule],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
