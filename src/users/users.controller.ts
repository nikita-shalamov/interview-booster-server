import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { User } from 'src/auth/decorators/user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get('all')
  findAll() {
    return this.usersService.findAll();
  }

  @Auth()
  @Get()
  getProfile(@User('id') currentUserId: number) {
    return this.usersService.findOne(currentUserId);
  }

  @Auth()
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

  @Auth()
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
