import { Module } from '@nestjs/common';
import { KebiModule } from '../kebi/kebi.module';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';

@Module({
  imports: [KebiModule],
  controllers: [PlacesController],
  providers: [PlacesService],
})
export class PlacesModule {}
