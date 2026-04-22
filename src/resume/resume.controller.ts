import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
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

  @Post(':id/analyze')
  analyze(@Param('id') id: string, @User('id') userId: number) {
    return this.resumeService.analyze(+id, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @User('id') userId: number) {
    return this.resumeService.remove(+id, userId);
  }
}
