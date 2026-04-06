import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { Onboarding } from './entities/onboarding.entity';
import { RoadmapModule } from '../roadmap/roadmap.module';

@Module({
  imports: [TypeOrmModule.forFeature([Onboarding]), RoadmapModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
