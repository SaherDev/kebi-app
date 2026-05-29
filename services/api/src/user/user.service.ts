import { Inject, Injectable } from '@nestjs/common';
import type { DataScope } from '@kebi-app/shared';
import {
  AI_SERVICE_CLIENT,
  type IAiServiceClient,
} from '../ai-service/ai-service-client.interface';

@Injectable()
export class UserService {
  constructor(
    @Inject(AI_SERVICE_CLIENT) private readonly aiClient: IAiServiceClient
  ) {}

  async deleteData(userId: string, scopes?: DataScope[]): Promise<void> {
    await this.aiClient.deleteUserData(userId, scopes);
  }
}
