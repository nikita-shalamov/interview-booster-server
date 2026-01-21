import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { Onboarding } from './entities/onboarding.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Onboarding])],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
