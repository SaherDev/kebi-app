import { Injectable } from '@nestjs/common';
import type {
  DataScope,
  IntentsResponse,
  LibraryResponse,
  LibraryUserData,
  PlanTier,
  SaveUserPlaceRequest,
  UpdateUserPlaceRequest,
} from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import { IntentsQueryDto } from './dto/intents-query.dto';
import { LibraryQueryDto } from './dto/library-query.dto';
import { SaveUserPlaceDto } from './dto/save-user-place.dto';
import { UpdateUserPlaceDto } from './dto/update-user-place.dto';

@Injectable()
export class UserService {
  constructor(private readonly kebi: KebiHttpClient) {}

  async getLibrary(
    userId: string,
    query: LibraryQueryDto
  ): Promise<LibraryResponse> {
    const qs = new URLSearchParams();
    // Omitted fields are dropped; booleans/numbers are stringified; repeatable
    // params (category/tag) become repeated query params.
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) qs.append(key, String(v));
      } else {
        qs.append(key, String(value));
      }
    }
    const queryString = qs.toString();
    const path = queryString
      ? `/v1/user/library?${queryString}`
      : '/v1/user/library';
    return this.kebi.get<LibraryResponse>(path, userId);
  }

  async getIntents(
    userId: string,
    query: IntentsQueryDto
  ): Promise<IntentsResponse> {
    const qs = new URLSearchParams();
    // Omitted fields are dropped; scalars are stringified. Identity travels in
    // the X-Gateway-User-Id header, never the query.
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      qs.append(key, String(value));
    }
    const queryString = qs.toString();
    const path = queryString
      ? `/v1/user/intents?${queryString}`
      : '/v1/user/intents';
    return this.kebi.get<IntentsResponse>(path, userId);
  }

  async savePlace(
    userId: string,
    dto: SaveUserPlaceDto,
    plan?: PlanTier,
  ): Promise<LibraryUserData> {
    const body: SaveUserPlaceRequest = {
      place_core_id: dto.place_core_id,
      recommendation_id: dto.recommendation_id,
    };
    // plan rides along so kebi can enforce the save_limit (ADR-112); a re-save
    // of an existing place is idempotent and never counts against the cap.
    return this.kebi.post<LibraryUserData>('/v1/user/places', userId, body, plan);
  }

  async updatePlace(
    userId: string,
    userPlaceId: string,
    dto: UpdateUserPlaceDto
  ): Promise<LibraryUserData> {
    const body: UpdateUserPlaceRequest = dto;
    return this.kebi.patch<LibraryUserData>(
      `/v1/user/places/${encodeURIComponent(userPlaceId)}`,
      userId,
      body
    );
  }

  async deletePlace(userId: string, userPlaceId: string): Promise<void> {
    await this.kebi.delete<void>(
      `/v1/user/places/${encodeURIComponent(userPlaceId)}`,
      userId
    );
  }

  async deleteData(userId: string, scopes?: DataScope[]): Promise<void> {
    let path = '/v1/user/data';
    if (scopes && scopes.length > 0) {
      const qs = new URLSearchParams();
      for (const scope of scopes) qs.append('scope', scope);
      path += `?${qs.toString()}`;
    }
    await this.kebi.delete<void>(path, userId);
  }
}
