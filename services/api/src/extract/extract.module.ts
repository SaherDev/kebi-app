import { Module } from '@nestjs/common';
import { AiServiceModule } from '../ai-service/ai-service.module';
import { ExtractController } from './extract.controller';
import { ExtractService } from './extract.service';

@Module({
  imports: [AiServiceModule],
  controllers: [ExtractController],
  providers: [ExtractService],
})
export class ExtractModule {}
