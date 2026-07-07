/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app/app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const apiPrefix = configService.get<string>('app.api_prefix');
  const port = process.env.PORT || configService.get<number>('app.port');
  const corsOrigins = (configService.get<string>('APP_CORS_ORIGINS') ?? '').split(',').filter(Boolean);

  if (!port) {
    throw new Error('PORT environment variable is not set.');
  }
  if (!apiPrefix) {
    throw new Error('app.api_prefix is not set. config/app.yaml failed to load.');
  }

  app.enableCors({ origin: corsOrigins, credentials: true });

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  app.setGlobalPrefix(apiPrefix);
  await app.listen(port);
  Logger.log(`🚀 Application is running on: http://localhost:${port}/${apiPrefix}`);
}

bootstrap();
