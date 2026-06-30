import { Module } from '@nestjs/common';
import { KebiModule } from '../kebi/kebi.module';
import { AuthModule } from '../auth/auth.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [KebiModule, AuthModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
