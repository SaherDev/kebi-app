import { Injectable } from '@nestjs/common';
import type { PlaceView } from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';

@Injectable()
export class PlacesService {
  constructor(private readonly kebi: KebiHttpClient) {}

  /**
   * One catalog place, saved by the caller or not (api-contract.md
   * §GET /v1/places/{place_id}, ADR-151). Returns the same shape as a library
   * entry, with `user_data: null` when the caller never saved it. Identity
   * travels in the X-Gateway-User-Id header, so the caller only ever sees their
   * own relationship to the place.
   */
  async getPlace(userId: string, placeId: string): Promise<PlaceView> {
    return this.kebi.get<PlaceView>(
      `/v1/places/${encodeURIComponent(placeId)}`,
      userId
    );
  }
}
