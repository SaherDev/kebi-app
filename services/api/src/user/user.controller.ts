import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type {
  AuthUser,
  LibraryResponse,
  LibraryUserData,
} from '@kebi-app/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DeleteUserDataQueryDto } from './dto/delete-user-data.query.dto';
import { LibraryQueryDto } from './dto/library-query.dto';
import { SaveUserPlaceDto } from './dto/save-user-place.dto';
import { UpdateUserPlaceDto } from './dto/update-user-place.dto';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('library')
  async getLibrary(
    @CurrentUser() user: AuthUser,
    @Query() query: LibraryQueryDto
  ): Promise<LibraryResponse> {
    return this.userService.getLibrary(user.id, query);
  }

  @Post('places')
  @HttpCode(HttpStatus.CREATED)
  async savePlace(
    @CurrentUser() user: AuthUser,
    @Body() dto: SaveUserPlaceDto
  ): Promise<LibraryUserData> {
    return this.userService.savePlace(user.id, dto);
  }

  @Patch('places/:id')
  async updatePlace(
    @CurrentUser() user: AuthUser,
    @Param('id') userPlaceId: string,
    @Body() dto: UpdateUserPlaceDto
  ): Promise<LibraryUserData> {
    return this.userService.updatePlace(user.id, userPlaceId, dto);
  }

  @Delete('places/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePlace(
    @CurrentUser() user: AuthUser,
    @Param('id') userPlaceId: string
  ): Promise<void> {
    await this.userService.deletePlace(user.id, userPlaceId);
  }

  @Delete('data')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteData(
    @CurrentUser() user: AuthUser,
    @Query() query: DeleteUserDataQueryDto
  ): Promise<void> {
    await this.userService.deleteData(user.id, query.scope);
  }
}
