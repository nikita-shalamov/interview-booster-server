import {
  Controller,
  Get,
  Body,
  Param,
  Delete,
  Put,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { User } from 'src/auth/decorators/user.decorator';

@Auth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getProfile(@User('id') currentUserId: number) {
    return this.usersService.findOne(currentUserId);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @User('id') currentUserId: number,
  ) {
    if (id !== currentUserId) {
      throw new ForbiddenException('You can only update your own data');
    }
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @User('id') currentUserId: number,
  ) {
    if (id !== currentUserId) {
      throw new ForbiddenException('You can only delete your own account');
    }
    return this.usersService.remove(id);
  }
}
