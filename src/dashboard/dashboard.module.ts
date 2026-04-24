import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Resume } from '../resume/entities/resume.entity';
import { Chat } from '../chat/entities/chat.entity';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { RoadmapModule } from '../roadmap/roadmap.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Resume, Chat]),
    OnboardingModule,
    RoadmapModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
