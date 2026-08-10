import { Module } from '@nestjs/common';
import { KebiModule } from '../kebi/kebi.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatUserProfileFactory } from './chat-user-profile.factory';

@Module({
  imports: [KebiModule, RateLimitModule],
  controllers: [ChatController],
  providers: [ChatService, ChatUserProfileFactory],
})
export class ChatModule {}
