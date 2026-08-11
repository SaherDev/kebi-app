import { Injectable } from '@nestjs/common';
import type {
  CurateKnowledgeResponse,
  EntitySearchResponse,
  KnowledgeClaimsResponse,
} from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import { CurateKnowledgeDto } from './dto/curate-knowledge-request.dto';
import { ClaimsQueryDto } from './dto/claims-query.dto';
import { EntitiesQueryDto } from './dto/entities-query.dto';

/** Query string from a validated DTO — omitted fields are dropped, scalars stringified. */
function queryString(query: object): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    qs.append(key, String(value));
  }
  return qs.toString();
}

@Injectable()
export class KnowledgeService {
  constructor(private readonly kebi: KebiHttpClient) {}

  /**
   * Forward curated prose to kebi, carrying the caller's curator role as the
   * X-Gateway-Can-Curate capability. The role comes claim-first from the token
   * (never self-asserted); kebi enforces it independently and 403s when false.
   *
   * The anchor is forwarded verbatim and matters more than "optional" suggests:
   * without one, kebi can only store geo-scoped claims (ADR-160), so a note
   * written about a venue lands on its city instead of the venue.
   */
  async curate(
    userId: string,
    dto: CurateKnowledgeDto,
    canCurate: boolean,
  ): Promise<CurateKnowledgeResponse> {
    return this.kebi.post<CurateKnowledgeResponse>(
      '/v1/knowledge/curate',
      userId,
      { text: dto.text, anchor: dto.anchor },
      undefined,
      { canCurate },
    );
  }

  /**
   * One newest-first page of the caller's own curated claims — what backs "what
   * you've added". Ownership is resolved upstream from the forwarded user id;
   * the gateway never filters by author itself, since these are global rows.
   */
  async listClaims(
    userId: string,
    query: ClaimsQueryDto,
    canCurate: boolean,
  ): Promise<KnowledgeClaimsResponse> {
    const qs = queryString(query);
    const path = qs ? `/v1/knowledge/claims?${qs}` : '/v1/knowledge/claims';
    return this.kebi.get<KnowledgeClaimsResponse>(path, userId, { canCurate });
  }

  /**
   * Retract one of the caller's own claims. Author-only upstream: a claim that
   * isn't the caller's returns the same 404 as one that doesn't exist, so ids
   * can't be probed — the gateway forwards that indistinguishability as-is
   * rather than translating it into a 403.
   */
  async retractClaim(userId: string, claimId: string, canCurate: boolean): Promise<void> {
    await this.kebi.delete<void>(`/v1/knowledge/claims/${encodeURIComponent(claimId)}`, userId, {
      canCurate,
    });
  }

  /** Typeahead behind the anchor chip — places and areas in one typed list. */
  async searchEntities(
    userId: string,
    query: EntitiesQueryDto,
    canCurate: boolean,
  ): Promise<EntitySearchResponse> {
    return this.kebi.get<EntitySearchResponse>(
      `/v1/knowledge/entities?${queryString(query)}`,
      userId,
      { canCurate },
    );
  }
}
