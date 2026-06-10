import { Injectable } from '@nestjs/common';
import type {
  DataScope,
  LibraryResponse,
  LibraryUserData,
  UpdateUserPlaceRequest,
} from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import { LibraryQueryDto } from './dto/library-query.dto';
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
