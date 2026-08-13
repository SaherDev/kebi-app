import { Module } from '@nestjs/common';
import { KebiModule } from '../kebi/kebi.module';
import { AreasController } from './areas.controller';
import { AreasService } from './areas.service';

@Module({
  imports: [KebiModule],
  controllers: [AreasController],
  providers: [AreasService],
})
export class AreasModule {}
