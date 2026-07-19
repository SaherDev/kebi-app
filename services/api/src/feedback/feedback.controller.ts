import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { AuthUser, FeedbackResponse, NormalizedIdentity } from '@kebi-app/shared';
import { CurrentIdentity } from '../common/decorators/current-identity.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FeedbackRequestDto } from './dto/feedback-request.dto';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  // Not @RequiresAi — feedback must keep flowing when AI is killed (ADR-022).
  // identity is undefined on the dev-bypass path; email is then omitted.
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async submit(
    @CurrentUser() user: AuthUser,
    @CurrentIdentity() identity: NormalizedIdentity | undefined,
    @Body() dto: FeedbackRequestDto,
  ): Promise<FeedbackResponse> {
    return this.feedbackService.submit(user.id, identity?.email, dto);
  }
}
