import { Inject, Injectable } from '@nestjs/common';
import type {
  AuthUser,
  DataScope,
  IntentsResponse,
  LibraryResponse,
  LibraryUserData,
  NormalizedIdentity,
  PlanTier,
  SaveUserPlaceRequest,
  UpdateUserPlaceRequest,
  UserProfile,
} from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import { PROFILE_WRITER } from '../auth/profile-writer.interface';
import type { ProfileWriter } from '../auth/profile-writer.interface';
import { IntentsQueryDto } from './dto/intents-query.dto';
import { LibraryQueryDto } from './dto/library-query.dto';
import { SaveUserPlaceDto } from './dto/save-user-place.dto';
import { UpdateUserPlaceDto } from './dto/update-user-place.dto';

/** Fallback tier if a (provisioned) token somehow lacks a plan claim. */
const DEFAULT_PLAN = 'homebody' as const;

@Injectable()
export class UserService {
  constructor(
    private readonly kebi: KebiHttpClient,
    @Inject(PROFILE_WRITER) private readonly profileWriter: ProfileWriter,
  ) {}

  /**
   * The user's display profile, read gateway-local (never forwarded to kebi).
   * `name`/`email` come from the verified JWT (Supabase PII); `plan` from the
   * product claim. The internal id is never exposed (scoped ADR-044 relaxation).
   */
  getProfile(identity: NormalizedIdentity, user: AuthUser): UserProfile {
    return {
      name: identity.name ?? '',
      email: identity.email ?? '',
      plan: user.plan ?? DEFAULT_PLAN,
    };
  }

  /**
   * Updates the display name (Supabase `user_metadata.name`). Echoes the
   * just-written name rather than re-reading the still-stale JWT — the response
   * is the client's source of truth until its token refreshes. A writer failure
   * propagates so the client can surface "save failed" and roll back.
   */
  async updateProfile(
    identity: NormalizedIdentity,
    user: AuthUser,
    name: string,
  ): Promise<UserProfile> {
    await this.profileWriter.setName(identity.externalId, name);
    return {
      name,
      email: identity.email ?? '',
      plan: user.plan ?? DEFAULT_PLAN,
    };
  }

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
