import { Inject, Injectable } from '@nestjs/common';
import type { SignalRequest, SignalResponse } from '@kebi-app/shared';
import {
  AI_SERVICE_CLIENT,
  type IAiServiceClient,
} from '../ai-service/ai-service-client.interface';
import { SignalRequestDto } from './dto/signal-request.dto';

@Injectable()
export class SignalService {
  constructor(
    @Inject(AI_SERVICE_CLIENT) private readonly aiClient: IAiServiceClient
  ) {}

  async submit(userId: string, dto: SignalRequestDto): Promise<SignalResponse> {
    const payload: SignalRequest = {
      signal_type: dto.signal_type,
      recommendation_id: dto.recommendation_id,
      place_core_id: dto.place_core_id,
    };
    return this.aiClient.postSignal(payload, userId);
  }
}
