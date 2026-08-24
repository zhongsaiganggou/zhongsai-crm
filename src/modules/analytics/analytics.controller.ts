import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/types/auth-user.type';
import { AnalyticsService } from './analytics.service';

@ApiTags('数据统计')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.analyticsService.overview(user);
  }

  @Roles(UserRole.ADMIN)
  @Get('ads')
  ads() {
    return this.analyticsService.ads();
  }
}

