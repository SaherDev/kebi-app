import { Injectable } from '@nestjs/common';
import type { ExtractPlaceResponse } from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import { ExtractRequestDto } from './dto/extract-request.dto';

@Injectable()
export class ExtractService {
  constructor(private readonly kebi: KebiHttpClient) {}

  async extract(
    userId: string,
    dto: ExtractRequestDto
  ): Promise<ExtractPlaceResponse> {
    return this.kebi.post<ExtractPlaceResponse>('/v1/extract', userId, {
      raw_input: dto.raw_input,
    });
  }
}
