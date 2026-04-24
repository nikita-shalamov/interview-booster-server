import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CoverLetterService } from './cover-letter.service';
import { CreateCoverLetterDto } from './dto/create-cover-letter.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { User } from '../auth/decorators/user.decorator';

@Auth()
@Controller('cover-letters')
export class CoverLetterController {
  constructor(private readonly coverLetterService: CoverLetterService) {}

  @Post()
  create(@User('id') userId: number, @Body() dto: CreateCoverLetterDto) {
    return this.coverLetterService.create(userId, dto);
  }

  @Get()
  findAll(@User('id') userId: number) {
    return this.coverLetterService.findAllByUser(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @User('id') userId: number) {
    return this.coverLetterService.findOne(+id, userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @User('id') userId: number,
    @Body('content') content: string,
  ) {
    return this.coverLetterService.update(+id, userId, content);
  }
}
