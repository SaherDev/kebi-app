import { Inject, Injectable } from '@nestjs/common';
import type {
  DataScope,
  LibraryResponse,
  LibraryUserData,
  UpdateUserPlaceRequest,
} from '@kebi-app/shared';
import {
  AI_SERVICE_CLIENT,
  type IAiServiceClient,
} from '../ai-service/ai-service-client.interface';
import { LibraryQueryDto } from './dto/library-query.dto';
import { UpdateUserPlaceDto } from './dto/update-user-place.dto';

@Injectable()
export class UserService {
  constructor(
    @Inject(AI_SERVICE_CLIENT) private readonly aiClient: IAiServiceClient
  ) {}

  async getLibrary(
    userId: string,
    query: LibraryQueryDto
  ): Promise<LibraryResponse> {
    return this.aiClient.getUserLibrary(toQueryRecord(query), userId);
  }

  async updatePlace(
    userId: string,
    userPlaceId: string,
    dto: UpdateUserPlaceDto
  ): Promise<LibraryUserData> {
    const body: UpdateUserPlaceRequest = dto;
    return this.aiClient.updateUserPlace(userPlaceId, body, userId);
  }

  async deletePlace(userId: string, userPlaceId: string): Promise<void> {
    await this.aiClient.deleteUserPlace(userPlaceId, userId);
  }

  async deleteData(userId: string, scopes?: DataScope[]): Promise<void> {
    await this.aiClient.deleteUserData(userId, scopes);
  }
}

/**
 * Flatten a validated LibraryQueryDto into the string-valued query record the
 * AI client forwards upstream. Omitted fields are dropped; booleans/numbers are
 * stringified; repeatable params (category/tag) stay arrays.
 */
function toQueryRecord(
  query: LibraryQueryDto
): Record<string, string | string[]> {
  const record: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    record[key] = Array.isArray(value) ? value.map(String) : String(value);
  }
  return record;
}
