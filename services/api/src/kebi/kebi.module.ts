import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { KebiHttpClient } from './kebi-http.client';

/**
 * Provides the shared signed-HTTP transport to kebi. Domain services inject
 * KebiHttpClient directly and call it with their own route + payload:
 *   constructor(private readonly kebi: KebiHttpClient) {}
 *   this.kebi.post('/v1/signal', userId, payload)
 *
 * KebiHttpClient is internal infrastructure (a thin wrapper over HttpService),
 * not a swappable external dependency — so it is injected concretely, the same
 * way HttpService/ConfigService are. ADR-033's interface-first rule targets
 * swappable externals (e.g. the auth provider), not infra transports (ADR-047).
 * Only the chat stream is an AI operation; the rest are plain forwards.
 */
@Module({
  imports: [ConfigModule, HttpModule],
  providers: [KebiHttpClient],
  exports: [KebiHttpClient],
})
export class KebiModule {}
