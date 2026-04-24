import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { User } from '../auth/decorators/user.decorator';

@Auth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboard(@User('id') userId: number) {
    return this.dashboardService.getDashboard(userId);
  }
}
