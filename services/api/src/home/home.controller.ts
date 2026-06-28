import { Controller, Get, Query } from '@nestjs/common';
import type { AuthUser, HomeResponse } from '@kebi-app/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { HomeQueryDto } from './dto/home-query.dto';
import { HomeService } from './home.service';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  async getHome(
    @CurrentUser() user: AuthUser,
    @Query() query: HomeQueryDto
  ): Promise<HomeResponse> {
    return this.homeService.getHome(user.id, query);
  }
}
