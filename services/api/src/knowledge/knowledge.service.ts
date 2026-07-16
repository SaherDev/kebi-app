import { Injectable } from '@nestjs/common';
import type { CurateKnowledgeResponse } from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import { CurateKnowledgeDto } from './dto/curate-knowledge-request.dto';

@Injectable()
export class KnowledgeService {
  constructor(private readonly kebi: KebiHttpClient) {}

  /**
   * Forward curated prose to kebi, carrying the caller's curator role as the
   * X-Gateway-Can-Curate capability. The role comes claim-first from the token
   * (never self-asserted); kebi enforces it independently and 403s when false.
   */
  async curate(
    userId: string,
    dto: CurateKnowledgeDto,
    canCurate: boolean,
  ): Promise<CurateKnowledgeResponse> {
    return this.kebi.post<CurateKnowledgeResponse>(
      '/v1/knowledge/curate',
      userId,
      { text: dto.text, location_hint: dto.location_hint },
      undefined,
      { canCurate },
    );
  }
}
