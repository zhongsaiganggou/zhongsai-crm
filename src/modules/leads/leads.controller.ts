import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/types/auth-user.type';
import { AssignmentService } from './assignment.service';
import { AssignmentConfigDto } from './dto/assignment-config.dto';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { ReviewLeadDto } from './dto/review-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { PoolReclaimConfigDto } from './dto/pool-reclaim-config.dto';
import { LeadsService } from './leads.service';
import { PoolReclaimService } from '../scheduler/pool-reclaim.service';

@ApiTags('客户线索')
@ApiBearerAuth()
@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly assignmentService: AssignmentService,
    private readonly poolReclaimService: PoolReclaimService,
  ) {}

  @Get('statuses')
  statuses() {
    return this.leadsService.getStatuses();
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryLeadsDto) {
    return this.leadsService.findAll(user, query);
  }

  @Get('pool')
  findPool(@CurrentUser() user: AuthUser, @Query() query: QueryLeadsDto) {
    return this.leadsService.findAll(user, { ...query, assignmentState: 'UNASSIGNED' });
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLeadDto) {
    return this.leadsService.createManual(user, dto);
  }

  @Get('assignment-config')
  @Roles(UserRole.ADMIN)
  getAssignmentConfig() {
    return this.assignmentService.getConfig();
  }

  @Put('assignment-config')
  @Roles(UserRole.ADMIN)
  saveAssignmentConfig(@CurrentUser() user: AuthUser, @Body() config: AssignmentConfigDto) {
    return this.assignmentService.saveConfig(config, user.id);
  }

  @Get('pool-config')
  @Roles(UserRole.ADMIN)
  getPoolConfig() {
    return this.poolReclaimService.getConfig();
  }

  @Put('pool-config')
  @Roles(UserRole.ADMIN)
  savePoolConfig(@CurrentUser() user: AuthUser, @Body() config: PoolReclaimConfigDto) {
    return this.poolReclaimService.saveConfig(config, user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.leadsService.findOne(user, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(user, id, dto);
  }

  @Patch(':id/status')
  changeStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ChangeStatusDto) {
    return this.leadsService.changeStatus(user, id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/assign')
  assign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AssignLeadDto) {
    return this.leadsService.assign(user.id, id, dto.userId, dto.reason);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/auto-assign')
  autoAssign(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assignmentService.autoAssign(id, user.id);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/reclaim')
  reclaim(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { reason?: string }) {
    return this.poolReclaimService.reclaimLead(id, user.id, body.reason);
  }

  @Post(':id/claim')
  claim(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.poolReclaimService.claimLead(id, user.id);
  }

  @Post(':id/review')
  review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewLeadDto) {
    return this.leadsService.review(user, id, dto);
  }
}

