import { Injectable } from '@nestjs/common';
import type { ExtractPlaceResponse, PlanTier } from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import { ExtractRequestDto } from './dto/extract-request.dto';

@Injectable()
export class ExtractService {
  constructor(private readonly kebi: KebiHttpClient) {}

  async extract(
    userId: string,
    dto: ExtractRequestDto,
    plan?: PlanTier,
  ): Promise<ExtractPlaceResponse> {
    // plan rides along so kebi can enforce the save_limit before the pipeline runs (ADR-112).
    return this.kebi.post<ExtractPlaceResponse>(
      '/v1/extract',
      userId,
      { raw_input: dto.raw_input },
      plan,
    );
  }
}
