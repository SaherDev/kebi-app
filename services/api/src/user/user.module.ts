import { Module } from '@nestjs/common';
import { KebiModule } from '../kebi/kebi.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [KebiModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
