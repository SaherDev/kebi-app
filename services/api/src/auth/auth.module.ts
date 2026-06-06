import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import {
  IDENTITY_PROVIDER,
  IdentityProvider,
} from './identity-provider.interface';
import {
  IDENTITY_METADATA_WRITER,
  IdentityMetadataWriter,
} from './identity-metadata.writer';
import { AppMetadataCipher } from './app-metadata.cipher';
import { SupabaseIdentityProvider } from './providers/supabase-identity.provider';
import { NoopMetadataWriter } from './providers/noop-metadata.writer';
import { SupabaseMetadataWriter } from './providers/supabase-metadata.writer';
import { UserIdentityRepository } from './user-identity.repository';
import { UserIdentityService } from './user-identity.service';
import { UserSettingsRepository } from './user-settings.repository';
import { UserSettingsService } from './user-settings.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const DEFAULT_PROVIDER = 'supabase';

/**
 * Auth module — owns provider verification behind the IdentityProvider
 * interface. The active provider is selected from config (`auth.provider`) via a
 * registry map, so adding a provider is a new class + one registry entry + a
 * config flip — never an edit to the request path.
 */
@Module({
  imports: [HttpModule],
  controllers: [AuthController],
  providers: [
    AppMetadataCipher,
    SupabaseIdentityProvider,
    NoopMetadataWriter,
    SupabaseMetadataWriter,
    UserIdentityRepository,
    UserIdentityService,
    UserSettingsRepository,
    UserSettingsService,
    AuthService,
    {
      provide: IDENTITY_PROVIDER,
      inject: [ConfigService, SupabaseIdentityProvider],
      useFactory: (
        config: ConfigService,
        supabase: SupabaseIdentityProvider,
      ) => {
        const registry: Record<string, IdentityProvider> = {
          [supabase.name]: supabase,
        };
        const name = config.get<string>('auth.provider', DEFAULT_PROVIDER);
        const provider = registry[name];
        if (!provider) {
          throw new Error(`Unknown auth.provider: ${name}`);
        }
        return provider;
      },
    },
    {
      // Selected by the same `auth.provider` key. Supabase stamps app_metadata
      // via the Admin API; any provider that stamps out-of-band gets the no-op.
      provide: IDENTITY_METADATA_WRITER,
      inject: [ConfigService, NoopMetadataWriter, SupabaseMetadataWriter],
      useFactory: (
        config: ConfigService,
        noop: NoopMetadataWriter,
        supabase: SupabaseMetadataWriter,
      ): IdentityMetadataWriter => {
        const name = config.get<string>('auth.provider', DEFAULT_PROVIDER);
        return name === 'supabase' ? supabase : noop;
      },
    },
  ],
  exports: [IDENTITY_PROVIDER, IDENTITY_METADATA_WRITER, UserIdentityService],
})
export class AuthModule {}
