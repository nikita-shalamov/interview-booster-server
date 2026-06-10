import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { Onboarding } from './entities/onboarding.entity';
import { RoadmapModule } from '../roadmap/roadmap.module';
import { ResumeModule } from '../resume/resume.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Onboarding]),
    RoadmapModule,
    forwardRef(() => ResumeModule),
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
