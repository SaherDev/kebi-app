import { Inject, Injectable } from '@nestjs/common';
import type { ExtractPlaceResponse } from '@kebi-app/shared';
import {
  AI_SERVICE_CLIENT,
  type IAiServiceClient,
} from '../ai-service/ai-service-client.interface';
import { ExtractRequestDto } from './dto/extract-request.dto';

@Injectable()
export class ExtractService {
  constructor(
    @Inject(AI_SERVICE_CLIENT) private readonly aiClient: IAiServiceClient
  ) {}

  async extract(
    userId: string,
    dto: ExtractRequestDto
  ): Promise<ExtractPlaceResponse> {
    return this.aiClient.extractPlace({ raw_input: dto.raw_input }, userId);
  }
}
