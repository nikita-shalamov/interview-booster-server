import { Controller, Get, Post, Body, Patch } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { User } from '../auth/decorators/user.decorator';
import { UIMessage } from 'ai';

@Auth()
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post()
  create(@Body() dto: { messages: UIMessage[] }, @User('id') userId: number) {
    return this.onboardingService.create({ ...dto, user_id: userId });
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
