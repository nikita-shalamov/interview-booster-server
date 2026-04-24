import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoverLetterService } from './cover-letter.service';
import { CoverLetterController } from './cover-letter.controller';
import { CoverLetter } from './entities/cover-letter.entity';
import { AiModule } from '../ai/ai.module';
import { ResumeModule } from '../resume/resume.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { RoadmapModule } from '../roadmap/roadmap.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CoverLetter]),
    AiModule,
    ResumeModule,
    OnboardingModule,
    RoadmapModule,
  ],
  controllers: [CoverLetterController],
  providers: [CoverLetterService],
})
export class CoverLetterModule {}
