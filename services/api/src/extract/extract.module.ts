import { Module } from '@nestjs/common';
import { KebiModule } from '../kebi/kebi.module';
import { ExtractController } from './extract.controller';
import { ExtractService } from './extract.service';

@Module({
  imports: [KebiModule],
  controllers: [ExtractController],
  providers: [ExtractService],
})
export class ExtractModule {}
