import { Controller, Get, Param } from '@nestjs/common';
import type { AreaScreenView, AuthUser } from '@kebi-app/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AreasService } from './areas.service';

@Controller('areas')
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  /**
   * The area screen behind every area link (kebi ADR-153) — every level of the
   * geo hierarchy opens here: country, region, neighbourhood. `id` is the last
   * segment of the `kebi://area/{id}` link the user tapped, and it is opaque to
   * this gateway.
   */
  @Get(':id')
  async getArea(
    @CurrentUser() user: AuthUser,
    @Param('id') areaId: string
  ): Promise<AreaScreenView> {
    return this.areasService.getArea(user.id, areaId);
  }
}
