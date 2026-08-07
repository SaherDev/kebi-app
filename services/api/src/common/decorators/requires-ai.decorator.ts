import { UseGuards, applyDecorators } from '@nestjs/common';
import { AiEnabledGuard } from '../guards/ai-enabled.guard';

/**
 * @RequiresAi() decorator applies the AiEnabledGuard to endpoints that require AI access.
 * Shorthand for @UseGuards(AiEnabledGuard).
 *
 * Validates:
 * 1. Global AI kill switch is off
 * 2. User has AI enabled in their account
 *
 * @example
 * @Post('/places')
 * @RequiresAi()
 * async savePlace(@CurrentUser() user: AuthUser, @Body() dto: SaveUserPlaceDto) {
 *   return this.userService.savePlace(user.id, dto, user.plan);
 * }
 */
export const RequiresAi = () => applyDecorators(UseGuards(AiEnabledGuard));
