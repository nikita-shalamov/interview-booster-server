import { Body, Controller, Get, Param, Post, Query, BadRequestException } from '@nestjs/common';
import { InterviewService } from './interview.service';
import { InterviewTemplateService } from './services/interview-template.service';
import type { GetInterviewTemplatesQuery } from './services/interview-template.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { User } from '../auth/decorators/user.decorator';

@Auth()
@Controller('interviews')
export class InterviewController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly templateService: InterviewTemplateService,
  ) {}

  @Post()
  create(@User('id') userId: number, @Body() dto: CreateInterviewDto) {
    return this.interviewService.create(userId, dto);
  }

  @Get('list')
  findAll(@User('id') userId: number) {
    return this.interviewService.findAllByUser(userId);
  }

  @Get('one/:id')
  findOne(@Param('id') id: string, @User('id') userId: number) {
    return this.interviewService.findOne(+id, userId);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @User('id') userId: number) {
    return this.interviewService.complete(+id, userId);
  }

  @Get('templates/recommended')
  getRecommended(@User('id') userId: number) {
    return this.templateService.getRecommended(userId);
  }

  @Get('templates/browse')
  getTemplates(@Query() query: GetInterviewTemplatesQuery) {
    return this.templateService.findWithFilters(query);
  }

  @Get('templates/my')
  getMyTemplates(@User('id') userId: number) {
    return this.templateService.findUserTemplates(userId);
  }

  @Post('templates/generate')
  generateTemplate(
    @User('id') userId: number,
    @Body('prompt') prompt: string,
  ) {
    if (!prompt?.trim()) throw new BadRequestException('prompt is required');
    return this.templateService.generateForUser(userId, prompt);
  }

  @Post('from-template/:templateId')
  createFromTemplate(
    @Param('templateId') templateId: string,
    @User('id') userId: number,
  ) {
    return this.templateService.createFromTemplate(userId, +templateId);
  }


}
