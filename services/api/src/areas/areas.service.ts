import { Injectable } from '@nestjs/common';
import type { AreaScreenView } from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';

@Injectable()
export class AreasService {
  constructor(private readonly kebi: KebiHttpClient) {}

  /**
   * One area screen (api-contract.md §GET /v1/areas/{area_id}, kebi ADR-153).
   *
   * `areaId` is the **encoded** geo key — the last segment of the
   * `kebi://area/{id}` link the user tapped, not the raw slash path on the
   * entity's `key`. The gateway treats it as opaque: it never decodes, splits,
   * or validates the token, so the codec stays kebi's alone and a change there
   * needs no deploy here. A token this gateway did not mint fails as a 404 from
   * kebi (`detail: area_not_found`), which is the correct answer anyway.
   *
   * Identity travels in the X-Gateway-User-Id header, so the personal half of
   * the response (`saved_count`, `section`) is only ever the caller's own.
   */
  async getArea(userId: string, areaId: string): Promise<AreaScreenView> {
    return this.kebi.get<AreaScreenView>(
      `/v1/areas/${encodeURIComponent(areaId)}`,
      userId
    );
  }
}
