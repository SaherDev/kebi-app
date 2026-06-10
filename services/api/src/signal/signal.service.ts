import { Injectable } from '@nestjs/common';
import type { SignalRequest, SignalResponse } from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import { SignalRequestDto } from './dto/signal-request.dto';

@Injectable()
export class SignalService {
  constructor(private readonly kebi: KebiHttpClient) {}

  async submit(userId: string, dto: SignalRequestDto): Promise<SignalResponse> {
    const payload: SignalRequest = {
      signal_type: dto.signal_type,
      recommendation_id: dto.recommendation_id,
      place_core_id: dto.place_core_id,
    };
    return this.kebi.post<SignalResponse>('/v1/signal', userId, payload);
  }
}
