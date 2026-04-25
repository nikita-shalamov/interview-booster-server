import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InterviewService } from './interview.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { User } from '../auth/decorators/user.decorator';

@Auth()
@Controller('interviews')
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}

  @Post()
  create(@User('id') userId: number, @Body() dto: CreateInterviewDto) {
    return this.interviewService.create(userId, dto);
  }

  @Get()
  findAll(@User('id') userId: number) {
    return this.interviewService.findAllByUser(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @User('id') userId: number) {
    return this.interviewService.findOne(+id, userId);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @User('id') userId: number) {
    return this.interviewService.complete(+id, userId);
  }
}
