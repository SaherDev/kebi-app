import { Module } from '@nestjs/common';
import { KebiModule } from '../kebi/kebi.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [KebiModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
