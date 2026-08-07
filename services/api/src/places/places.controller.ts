import { Controller, Get, Param } from '@nestjs/common';
import type { AuthUser, PlaceView } from '@kebi-app/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PlacesService } from './places.service';

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  /**
   * The place screen behind every venue link (ADR-151) — any place kebi has
   * surfaced opens here, saved or not. `id` is the `key` on the
   * `kebi://venue/{id}` link the user tapped.
   */
  @Get(':id')
  async getPlace(
    @CurrentUser() user: AuthUser,
    @Param('id') placeId: string
  ): Promise<PlaceView> {
    return this.placesService.getPlace(user.id, placeId);
  }
}
