import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResumeService } from './resume.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { User } from '../auth/decorators/user.decorator';

@Auth()
@Controller('resume')
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @User('id') userId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.resumeService.upload(userId, file);
  }

  @Get()
  findAll(@User('id') userId: number) {
    return this.resumeService.findAllByUser(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @User('id') userId: number) {
    return this.resumeService.findOne(+id, userId);
  }

  @Patch(':id/content')
  updateContent(
    @Param('id') id: string,
    @User('id') userId: number,
    @Body() body: { contacts?: any; sections?: any[] },
  ) {
    return this.resumeService.updateContent(+id, userId, body);
  }

  @Post(':id/analyze')
  analyze(@Param('id') id: string, @User('id') userId: number) {
    return this.resumeService.analyze(+id, userId);
  }

  @Post(':id/evaluate')
  evaluate(@Param('id') id: string, @User('id') userId: number) {
    return this.resumeService.evaluate(+id, userId);
  }

  @Post(':id/ats')
  ats(@Param('id') id: string, @User('id') userId: number) {
    return this.resumeService.ats(+id, userId);
  }

  @Get(':id/export')
  async export(
    @Param('id') id: string,
    @User('id') userId: number,
    @Res() res: Response,
  ) {
    const pdf = await this.resumeService.export(+id, userId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="resume.pdf"',
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @User('id') userId: number) {
    return this.resumeService.remove(+id, userId);
  }
}
