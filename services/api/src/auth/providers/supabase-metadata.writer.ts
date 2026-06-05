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
 * Uses HttpService (like AiServiceClient) — no Supabase SDK dependency. Fails
 * open: any missing config or HTTP error is logged and swallowed so stamping
 * never breaks the request, which still has its id from the DB fallback.
 */
@Injectable()
export class SupabaseMetadataWriter implements IdentityMetadataWriter {
  private readonly logger = new Logger(SupabaseMetadataWriter.name);
  /** externalId → last stamp epoch ms, to dedupe repeated admin writes. */
  private readonly stampedAt = new Map<string, number>();
  private warnedMissingConfig = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly cipher: AppMetadataCipher,
  ) {}

  async stamp(externalId: string, claims: StampClaims): Promise<void> {
    // A token carries the stamped claims after its next refresh, so the fallback
    // path re-enters here every request only within the pre-refresh window —
    // dedupe admin writes to at most one per user per that window (≈ token TTL).
    const dedupeTtlMs = this.configService.get<number>(
      'auth.supabase.stamp_dedupe_ttl_ms',
      60 * 60 * 1000,
    );
    const last = this.stampedAt.get(externalId);
    const now = Date.now();
    if (last !== undefined && now - last < dedupeTtlMs) return;

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
      this.stampedAt.set(externalId, now);
      this.logger.log(
        `Stamped app_metadata for ${externalId}: internal_id=${claims.internal_id}, plan=${claims.plan ?? '—'}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to stamp app_metadata for ${externalId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
