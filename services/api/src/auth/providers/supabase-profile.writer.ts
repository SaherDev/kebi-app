import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ProfileWriter } from '../profile-writer.interface';

/**
 * Supabase profile writer. Persists the display name into the user's Supabase
 * `user_metadata` via the GoTrue Admin API (`PUT /auth/v1/admin/users/{id}`),
 * authenticated with the service-role key. GoTrue merges `user_metadata`,
 * preserving other keys; the new name rides the user's next minted token.
 *
 * Uses HttpService (like SupabaseMetadataWriter) — no Supabase SDK dependency.
 * Unlike the app_metadata stamp, this does NOT swallow errors: callers decide.
 * The seed during provisioning catches and ignores; an explicit PATCH lets the
 * failure surface so the client can show "save failed".
 */
@Injectable()
export class SupabaseProfileWriter implements ProfileWriter {
  private readonly logger = new Logger(SupabaseProfileWriter.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async setName(externalId: string, name: string): Promise<void> {
    const projectUrl = this.configService
      .get<string>('SUPABASE_PROJECT_URL')
      ?.replace(/\/+$/, '');
    const serviceKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    if (!projectUrl || !serviceKey) {
      // No way to write — surface as an error so callers that care (PATCH) can
      // report it; the seed path catches and ignores.
      throw new Error(
        'SUPABASE_PROJECT_URL / SUPABASE_SERVICE_ROLE_KEY unset — cannot write user_metadata.name',
      );
    }

    await firstValueFrom(
      this.httpService.put(
        `${projectUrl}/auth/v1/admin/users/${externalId}`,
        { user_metadata: { name } },
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
          timeout: this.configService.get<number>(
            'auth.supabase.profile_timeout_ms',
            5000,
          ),
        },
      ),
    );
    this.logger.log(`Updated user_metadata.name for ${externalId}`);
  }
}
