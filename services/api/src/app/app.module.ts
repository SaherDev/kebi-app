import {
  Module,
  MiddlewareConsumer,
  NestModule,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';
import * as yaml from 'yaml';
import * as fs from 'fs';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthMiddleware } from '../common/middleware/auth.middleware';
import { ClerkWebhookController } from '../webhooks/clerk.webhook';
import { AuthModule } from '../auth/auth.module';
import { AiEnabledGuard } from '../common/guards/ai-enabled.guard';
import { UserEntity } from '../database/entities/user.entity';
import { UserSettingsEntity } from '../database/entities/user-settings.entity';
import { DatabaseModule } from '../database/database.module';
import { ChatModule } from '../chat/chat.module';
import { ExtractModule } from '../extract/extract.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { SignalModule } from '../signal/signal.module';
import { UserModule } from '../user/user.module';

function loadAppYaml(): Record<string, unknown> {
  const candidates = [
    path.join(__dirname, 'config/app.yaml'),                     // bundled next to main.js
    path.join(process.cwd(), 'config/app.yaml'),                 // cwd = services/api on Railway
    path.join(process.cwd(), 'services/api/config/app.yaml'),    // cwd = monorepo root locally
  ];
  for (const p of candidates) {
    try {
      const content = fs.readFileSync(p, 'utf-8');
      return yaml.parse(content) ?? {};
    } catch {
      continue;
    }
  }
  throw new Error(`config/app.yaml not found. Tried: ${candidates.join(', ')}`);
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Secrets: loaded from .env.local for local dev; Railway injects them as env vars in production
      envFilePath: path.join(process.cwd(), 'services/api/.env.local'),
      // Non-secrets: loaded from committed app.yaml
      load: [loadAppYaml],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [UserEntity, UserSettingsEntity],
        // Product tables (users, user_settings) are owned here; TypeORM keeps the
        // schema in sync. AI tables are owned by kebi (Alembic) and never touched.
        synchronize: true,
      }),
    }),
    DatabaseModule,
    AuthModule,
    ChatModule,
    ExtractModule,
    RateLimitModule,
    SignalModule,
    UserModule,
  ],
  controllers: [AppController, ClerkWebhookController],
  providers: [AppService, AiEnabledGuard],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}
