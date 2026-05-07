import { Inject, Injectable } from '@nestjs/common';
import type { AuthUser, DataScope, UserContextResponse } from '@kebi-app/shared';
import {
  AI_SERVICE_CLIENT,
  IAiServiceClient,
} from '../ai-service/ai-service-client.interface';

@Injectable()
export class UserService {
  constructor(
    @Inject(AI_SERVICE_CLIENT) private readonly aiClient: IAiServiceClient
  ) {}

  async getContext(user: AuthUser): Promise<UserContextResponse> {
    const aiContext = await this.aiClient.getUserContext(user.id);
    return { ...aiContext, plan: user.plan ?? null };
  }

  async deleteData(userId: string, scopes?: DataScope[]): Promise<void> {
    await this.aiClient.deleteUserData(userId, scopes);
  }
}
