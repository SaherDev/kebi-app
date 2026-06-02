import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IDENTITY_PROVIDER,
  IdentityProvider,
} from './identity-provider.interface';
import { ClerkIdentityProvider } from './providers/clerk-identity.provider';
import { SupabaseIdentityProvider } from './providers/supabase-identity.provider';
import { UserIdentityRepository } from './user-identity.repository';
import { UserIdentityService } from './user-identity.service';

/**
 * Auth module — owns provider verification behind the IdentityProvider
 * interface. The active provider is selected from config (`auth.provider`) via a
 * registry map, so adding a provider is a new class + one registry entry + a
 * config flip — never an edit to the request path.
 */
@Module({
  providers: [
    ClerkIdentityProvider,
    SupabaseIdentityProvider,
    UserIdentityRepository,
    UserIdentityService,
    {
      provide: IDENTITY_PROVIDER,
      inject: [ConfigService, ClerkIdentityProvider, SupabaseIdentityProvider],
      useFactory: (
        config: ConfigService,
        clerk: ClerkIdentityProvider,
        supabase: SupabaseIdentityProvider,
      ) => {
        const registry: Record<string, IdentityProvider> = {
          [clerk.name]: clerk,
          [supabase.name]: supabase,
        };
        const name = config.get<string>('auth.provider', 'clerk');
        const provider = registry[name];
        if (!provider) {
          throw new Error(`Unknown auth.provider: ${name}`);
        }
        return provider;
      },
    },
  ],
  exports: [IDENTITY_PROVIDER, UserIdentityService],
})
export class AuthModule {}
