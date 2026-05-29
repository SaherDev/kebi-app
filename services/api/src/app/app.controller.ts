import { Controller, Get, Request } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  /**
   * Health check endpoint (public, no auth required)
   * Public routes are determined by auth.public_paths in config, not decorators.
   */
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Protected route (requires valid Clerk token)
   */
  @Get('protected')
  protected(@Request() req: ExpressRequest) {
    return {
      message: 'Protected route accessed successfully',
      user: req.user,
    };
  }
}
