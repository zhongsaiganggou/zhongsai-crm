import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types/auth-user.type';
import { CreateFollowUpDto } from './dto/create-follow-up.dto';
import { FollowUpsService } from './follow-ups.service';

@ApiTags('跟进记录')
@ApiBearerAuth()
@Controller('leads/:leadId/follow-ups')
export class FollowUpsController {
  constructor(private readonly followUpsService: FollowUpsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Param('leadId') leadId: string, @Body() dto: CreateFollowUpDto) {
    return this.followUpsService.create(user, leadId, dto);
  }
}

