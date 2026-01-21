import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { User } from '../auth/decorators/user.decorator';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Auth()
  @Post()
  create(@Body() dto: CreateOnboardingDto, @User('id') userId: number) {
    return this.onboardingService.create({ ...dto, user_id: userId });
  }

  @Auth()
  @Get()
  findMyOnboarding(@User('id') userId: number) {
    return this.onboardingService.findByUserId(userId);
  }

  @Auth()
  @Patch()
  updateMyOnboarding(
    @Body() updateOnboardingDto: UpdateOnboardingDto,
    @User('id') userId: number,
  ) {
    return this.onboardingService.updateByUserId(userId, updateOnboardingDto);
  }

  @Get()
  findAll() {
    return this.onboardingService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.onboardingService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateOnboardingDto: UpdateOnboardingDto,
  ) {
    return this.onboardingService.update(+id, updateOnboardingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.onboardingService.remove(+id);
  }
}
