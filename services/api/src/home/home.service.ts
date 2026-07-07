import { Injectable } from '@nestjs/common';
import type { HomeResponse } from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import { HomeQueryDto } from './dto/home-query.dto';

@Injectable()
export class HomeService {
  constructor(private readonly kebi: KebiHttpClient) {}

  async getHome(userId: string, query: HomeQueryDto): Promise<HomeResponse> {
    const qs = new URLSearchParams();
    // Omitted fields are dropped; scalars are stringified. Identity travels in
    // the X-Gateway-User-Id header, never the query.
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      qs.append(key, String(value));
    }
    const queryString = qs.toString();
    const path = queryString ? `/v1/home?${queryString}` : '/v1/home';
    return this.kebi.get<HomeResponse>(path, userId);
  }
}
