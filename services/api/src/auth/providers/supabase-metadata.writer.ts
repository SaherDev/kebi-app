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
 */
@Injectable()
export class SupabaseMetadataWriter implements IdentityMetadataWriter {
  private readonly logger = new Logger(SupabaseMetadataWriter.name);
  /** externalId → signature of the last successfully-stamped claims (dedupe). */
  private readonly lastStamped = new Map<string, string>();
  private warnedMissingConfig = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly cipher: AppMetadataCipher,
  ) {}

  async stamp(externalId: string, claims: StampClaims): Promise<void> {
    // The token carries the stamped claims only after its next refresh, so the
    // fallback path re-enters here every request until then. Dedupe by the claims
    // themselves: skip an identical repeat, but always write when something
    // changed (e.g. a plan switch) so the change lands in the next token.
    const signature = this.signatureOf(claims);
    if (this.lastStamped.get(externalId) === signature) return;

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
      this.lastStamped.set(externalId, signature);
      this.logger.log(
        `Stamped app_metadata for ${externalId}: internal_id=${claims.internal_id}, plan=${claims.plan ?? '—'}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to stamp app_metadata for ${externalId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Stable signature of the claims, so an unchanged repeat dedupes. */
  private signatureOf(claims: StampClaims): string {
    return JSON.stringify([
      claims.internal_id,
      claims.plan ?? null,
      claims.ai_enabled ?? null,
      claims.movement_profile ?? null,
      claims.can_curate ?? null,
    ]);
  }
}
