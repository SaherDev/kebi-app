import { Module } from '@nestjs/common';
import { KebiModule } from '../kebi/kebi.module';
import { SignalController } from './signal.controller';
import { SignalService } from './signal.service';

@Module({
  imports: [KebiModule],
  controllers: [SignalController],
  providers: [SignalService],
})
export class SignalModule {}
