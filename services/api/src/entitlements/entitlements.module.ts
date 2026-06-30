import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EntitlementsService } from './entitlements.service';

/**
 * Resolves a caller's plan tier into the ADR-112 capability set from config.
 * Injected concretely by KebiHttpClient, which stamps the capabilities as
 * `X-Gateway-*` headers on the trusted channel to kebi.
 */
@Module({
  imports: [ConfigModule],
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
