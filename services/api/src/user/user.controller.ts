import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '@kebi-app/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiresAi } from '../common/decorators/requires-ai.decorator';
import { DeleteUserDataQueryDto } from './dto/delete-user-data.query.dto';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Delete('data')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequiresAi()
  async deleteData(
    @CurrentUser() user: AuthUser,
    @Query() query: DeleteUserDataQueryDto
  ): Promise<void> {
    await this.userService.deleteData(user.id, query.scope);
  }
}
