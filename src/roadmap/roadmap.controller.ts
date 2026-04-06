import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { RoadmapService } from './roadmap.service';
import { UpdateStepDto } from './dto/update-step.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { User } from '../auth/decorators/user.decorator';
import type { RoadmapStepKey } from './entities/roadmap.entity';

@Auth()
@Controller('roadmap')
export class RoadmapController {
  constructor(private readonly roadmapService: RoadmapService) {}

  @Get()
  findMyRoadmap(@User('id') userId: number) {
    return this.roadmapService.findByUserId(userId);
  }

  @Patch(':stepKey')
  updateStep(
    @Param('stepKey') stepKey: RoadmapStepKey,
    @Body() dto: UpdateStepDto,
    @User('id') userId: number,
  ) {
    return this.roadmapService.updateStep(userId, stepKey, dto.completedCount);
  }
}
