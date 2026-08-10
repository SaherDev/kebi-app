import { Inject, Injectable } from '@nestjs/common';
import type {
  AuthUser,
  DataScope,
  IntentsResponse,
  LibraryResponse,
  LibraryUserData,
  NormalizedIdentity,
  PlanTier,
  MovementProfile,
  SaveUserPlaceRequest,
  UpdateUserPlaceRequest,
  UserAboutMe,
  UserProfile,
} from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import { PROFILE_WRITER } from '../auth/profile-writer.interface';
import type { ProfileWriter } from '../auth/profile-writer.interface';
import { ClaimStamper } from '../auth/claim-stamper';
import { UserSettingsService } from '../auth/user-settings.service';
import { UpdateAboutMeDto } from './dto/update-about-me.dto';
import { UpdateMovementProfileDto } from './dto/update-movement-profile.dto';
import { IntentsQueryDto } from './dto/intents-query.dto';
import { LibraryQueryDto } from './dto/library-query.dto';
import { SaveUserPlaceDto } from './dto/save-user-place.dto';
import { UpdateUserPlaceDto } from './dto/update-user-place.dto';

/** Fallback tier if a (provisioned) token somehow lacks a plan claim. */
const DEFAULT_PLAN = 'homebody' as const;

/** What a fully-cleared about-me reads as — stored as null, echoed as fields. */
const EMPTY_ABOUT_ME: UserAboutMe = { call_me: null, home_country: null, about: null };

@Injectable()
export class UserService {
  constructor(
    private readonly kebi: KebiHttpClient,
    @Inject(PROFILE_WRITER) private readonly profileWriter: ProfileWriter,
    private readonly userSettings: UserSettingsService,
    private readonly claimStamper: ClaimStamper,
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

  /**
   * Switches the user's plan tier. Writes `user_settings.plan` (our product data)
   * then re-stamps the token claims from the new settings so the next refresh
   * carries the new plan — and with it the ADR-112 entitlements. Echoes the new
   * plan rather than the still-stale JWT claim, the client's source of truth until
   * its token refreshes.
   */
  async changePlan(
    identity: NormalizedIdentity,
    user: AuthUser,
    plan: PlanTier,
  ): Promise<UserProfile> {
    const settings = await this.userSettings.updatePlan(user.id, plan);
    await this.claimStamper.stamp(identity.externalId, user.id, settings);
    return {
      name: identity.name ?? '',
      email: identity.email ?? '',
      plan: settings.plan,
    };
  }

  /**
   * Write the about-me kebi reads as a cold-start prior (ADR-154). Stored whole:
   * a field the client omits is cleared, so there is no sentinel for "erase this"
   * and a cleared field is `null` rather than empty prose. Re-stamps the claims,
   * so the change reaches kebi on the next token refresh — same as a plan switch.
   *
   * `call_me` is stored here and nowhere else — one write, to our own row, with
   * no Admin-API round-trip to rename the account for a name only kebi asked
   * for. Cleared, it falls back to the account display name at forward time, so
   * the user is never left nameless.
   */
  async updateAboutMe(
    identity: NormalizedIdentity,
    user: AuthUser,
    dto: UpdateAboutMeDto,
  ): Promise<UserAboutMe> {
    const aboutMe: UserAboutMe = {
      call_me: dto.call_me ?? null,
      home_country: dto.home_country ?? null,
      about: dto.about ?? null,
    };
    const settings = await this.userSettings.updateAboutMe(user.id, aboutMe);
    await this.claimStamper.stamp(identity.externalId, user.id, settings);
    return settings.about_me ?? EMPTY_ABOUT_ME;
  }

  /**
   * Write modes a human actually chose. The settings service stamps
   * `source: 'user'` — reaching this method is the evidence for it (ADR-155) —
   * and only then does kebi honour the modes instead of its wide fallback.
   */
  async updateMovementProfile(
    identity: NormalizedIdentity,
    user: AuthUser,
    dto: UpdateMovementProfileDto,
  ): Promise<MovementProfile> {
    const settings = await this.userSettings.updateMovementProfile(user.id, dto);
    await this.claimStamper.stamp(identity.externalId, user.id, settings);
    // Non-null by construction — the setter always writes a profile.
    return settings.movement_profile as MovementProfile;
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
    // The place id is the whole body (ADR-151) — kebi 422s on any other key.
    const body: SaveUserPlaceRequest = { place_core_id: dto.place_core_id };
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
