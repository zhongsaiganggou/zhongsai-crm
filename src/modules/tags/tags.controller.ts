import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types/auth-user.type';
import { CreateTagDto } from './dto/create-tag.dto';
import { TagsService } from './tags.service';

@ApiTags('客户标签')
@ApiBearerAuth()
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.tagsService.findAll(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTagDto) {
    return this.tagsService.create(user, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tagsService.remove(user, id);
  }

  @Post(':tagId/leads/:leadId')
  addToLead(@CurrentUser() user: AuthUser, @Param('tagId') tagId: string, @Param('leadId') leadId: string) {
    return this.tagsService.addToLead(user, tagId, leadId);
  }

  @Delete(':tagId/leads/:leadId')
  removeFromLead(@CurrentUser() user: AuthUser, @Param('tagId') tagId: string, @Param('leadId') leadId: string) {
    return this.tagsService.removeFromLead(user, tagId, leadId);
  }
}

