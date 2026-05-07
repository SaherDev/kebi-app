import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { AuthUser, SignalResponse } from '@kebi-app/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiresAi } from '../common/decorators/requires-ai.decorator';
import { SignalRequestDto } from './dto/signal-request.dto';
import { SignalService } from './signal.service';

@Controller('signal')
export class SignalController {
  constructor(private readonly signalService: SignalService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @RequiresAi()
  async submit(
    @CurrentUser() user: AuthUser,
    @Body() dto: SignalRequestDto
  ): Promise<SignalResponse> {
    return this.signalService.submit(user.id, dto);
  }
}
