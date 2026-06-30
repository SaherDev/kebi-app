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
  IntentsResponse,
  LibraryResponse,
  LibraryUserData,
  NormalizedIdentity,
  UserProfile,
} from '@kebi-app/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentIdentity } from '../common/decorators/current-identity.decorator';
import { DeleteUserDataQueryDto } from './dto/delete-user-data.query.dto';
import { IntentsQueryDto } from './dto/intents-query.dto';
import { LibraryQueryDto } from './dto/library-query.dto';
import { SaveUserPlaceDto } from './dto/save-user-place.dto';
import { UpdateUserPlaceDto } from './dto/update-user-place.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  getProfile(
    @CurrentIdentity() identity: NormalizedIdentity,
    @CurrentUser() user: AuthUser
  ): UserProfile {
    return this.userService.getProfile(identity, user);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentIdentity() identity: NormalizedIdentity,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateUserProfileDto
  ): Promise<UserProfile> {
    return this.userService.updateProfile(identity, user, dto.name);
  }

  @Get('library')
  async getLibrary(
    @CurrentUser() user: AuthUser,
    @Query() query: LibraryQueryDto
  ): Promise<LibraryResponse> {
    return this.userService.getLibrary(user.id, query);
  }

  @Get('intents')
  async getIntents(
    @CurrentUser() user: AuthUser,
    @Query() query: IntentsQueryDto
  ): Promise<IntentsResponse> {
    return this.userService.getIntents(user.id, query);
  }

  @Post('places')
  @HttpCode(HttpStatus.CREATED)
  async savePlace(
    @CurrentUser() user: AuthUser,
    @Body() dto: SaveUserPlaceDto
  ): Promise<LibraryUserData> {
    return this.userService.savePlace(user.id, dto, user.plan);
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
