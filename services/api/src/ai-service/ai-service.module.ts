import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AiServiceClient } from './ai-service.client';
import { AI_SERVICE_CLIENT } from './ai-service-client.interface';

/**
 * Module providing the AiServiceClient for all modules that need to communicate
 * with the kebi service
 *
 * Usage in other modules:
 * 1. Import AiServiceModule
 * 2. Inject via @Inject(AI_SERVICE_CLIENT) and type as IAiServiceClient
 *
 * ADR-016: AiServiceClient implementation
 * ADR-033: Interface-first design — module provides the interface, not the concrete class
 */
@Module({
  imports: [ConfigModule, HttpModule],
  providers: [
    {
      provide: AI_SERVICE_CLIENT,
      useClass: AiServiceClient,
    },
  ],
  exports: [AI_SERVICE_CLIENT],
})
export class AiServiceModule {}
