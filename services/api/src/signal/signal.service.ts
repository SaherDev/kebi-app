import { Inject, Injectable } from '@nestjs/common';
import type {
  ChipItem,
  SignalRequestWithUser,
  SignalResponse,
} from '@kebi-app/shared';
import {
  AI_SERVICE_CLIENT,
  IAiServiceClient,
} from '../ai-service/ai-service-client.interface';
import { SignalRequestDto } from './dto/signal-request.dto';

@Injectable()
export class SignalService {
  constructor(
    @Inject(AI_SERVICE_CLIENT) private readonly aiClient: IAiServiceClient
  ) {}

  async submit(userId: string, dto: SignalRequestDto): Promise<SignalResponse> {
    return this.aiClient.postSignal(this.toWirePayload(userId, dto));
  }

  private toWirePayload(
    userId: string,
    dto: SignalRequestDto
  ): SignalRequestWithUser {
    if (dto.signal_type === 'chip_confirm') {
      const chips: ChipItem[] = (dto.metadata?.chips ?? []).map(chip => ({
        label: chip.label,
        source_field: chip.source_field,
        source_value: chip.source_value,
        signal_count: chip.signal_count,
        status: chip.status,
        selection_round: chip.selection_round,
      }));

      return {
        signal_type: 'chip_confirm',
        user_id: userId,
        metadata: { chips },
      };
    }

    return {
      signal_type: dto.signal_type,
      user_id: userId,
      recommendation_id: dto.recommendation_id!,
      place_id: dto.place_id!,
    };
  }
}
