import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OnboardingService } from './onboarding.service';
import { ResumeService } from '../resume/resume.service';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { User } from '../auth/decorators/user.decorator';
import { UIMessage } from 'ai';

@Auth()
@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly resumeService: ResumeService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('resume'))
  async create(
    @Body() body: { messages: string | UIMessage[] },
    @User('id') userId: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const messages: UIMessage[] =
      typeof body.messages === 'string'
        ? JSON.parse(body.messages)
        : body.messages;

    let resumeText: string | undefined;
    if (file) {
      const resume = await this.resumeService.upload(userId, file);
      resumeText = resume.originalText;
      this.resumeService.analyze(resume.id, userId).catch(() => {});
    }

    return this.onboardingService.create({ messages, user_id: userId, resumeText });
  }

  @Get()
  find(@User('id') userId: number) {
    return this.onboardingService.findByUserId(userId);
  }

  @Patch()
  update(
    @Body() updateOnboardingDto: UpdateOnboardingDto,
    @User('id') userId: number,
  ) {
    return this.onboardingService.updateByUserId(userId, updateOnboardingDto);
  }
}
