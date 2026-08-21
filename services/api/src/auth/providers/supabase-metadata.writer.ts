import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  IdentityMetadataWriter,
  StampClaims,
} from '../identity-metadata.writer';
import { AppMetadataCipher } from '../app-metadata.cipher';

/**
 * Supabase metadata writer. Persists product claims into the user's Supabase
 * `app_metadata` via the GoTrue Admin API (`PUT /auth/v1/admin/users/{id}`),
 * authenticated with the service-role key. `app_metadata` is server-write-only
 * and auto-embedded in every minted token, so once stamped the gateway reads
 * identity + plan claim-first with no DB hit.
 *
 * Uses HttpService (like KebiHttpClient) — no Supabase SDK dependency. Fails
 * open: any missing config or HTTP error is logged and swallowed so stamping
 * never breaks the request, which still has its id from the DB fallback.
 *
 * Every call writes. There used to be an in-memory dedupe of the last-written
 * claims per externalId, but it tracked what this process last wrote — not
 * what the account actually stores — so it could silently skip the write that
 * corrects an account someone else (another process, an older deploy) left
 * wrong. Stamps only happen at login-out-of-sync and on settings writes, both
 * rare; an occasional redundant Admin API PUT is the cheap side of that trade.
 */
@Injectable()
export class SupabaseMetadataWriter implements IdentityMetadataWriter {
  private readonly logger = new Logger(SupabaseMetadataWriter.name);
  private warnedMissingConfig = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly cipher: AppMetadataCipher,
  ) {}

  async stamp(externalId: string, claims: StampClaims): Promise<void> {
    const projectUrl = this.configService
      .get<string>('SUPABASE_PROJECT_URL')
      ?.replace(/\/+$/, '');
    const serviceKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    if (!projectUrl || !serviceKey || !this.cipher.isConfigured()) {
      if (!this.warnedMissingConfig) {
        this.logger.warn(
          'SUPABASE_PROJECT_URL / SUPABASE_SERVICE_ROLE_KEY / KEBI_APP_METADATA_KEY unset — skipping app_metadata stamping; identity falls back to the per-request DB resolve.',
        );
        this.warnedMissingConfig = true;
      }
      return;
    }

    // Seal our claims into one encrypted field so they're opaque in the token.
    // GoTrue merges this into existing app_metadata, preserving Supabase-managed
    // keys (`provider`/`providers`).
    const sealed: Record<string, unknown> = { internal_id: claims.internal_id };
    if (claims.plan !== undefined) sealed.plan = claims.plan;
    if (claims.ai_enabled !== undefined) sealed.ai_enabled = claims.ai_enabled;
    if (claims.movement_profile !== undefined)
      sealed.movement_profile = claims.movement_profile;
    if (claims.about_me !== undefined) sealed.about_me = claims.about_me;
    if (claims.can_curate !== undefined) sealed.can_curate = claims.can_curate;
    const appMetadata = { [this.cipher.field]: this.cipher.encrypt(sealed) };

    try {
      await firstValueFrom(
        this.httpService.put(
          `${projectUrl}/auth/v1/admin/users/${externalId}`,
          { app_metadata: appMetadata },
          {
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
            },
            timeout: this.configService.get<number>(
              'auth.supabase.stamp_timeout_ms',
              5000,
            ),
          },
        ),
      );
      this.logger.log(
        `Stamped app_metadata for ${externalId}: internal_id=${claims.internal_id}, plan=${claims.plan ?? '—'}`,
      );
    } catch (error) {
      this.logger.error(
        `[STAMP_FAILED] Failed to stamp app_metadata for ${externalId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
