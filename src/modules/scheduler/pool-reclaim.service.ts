import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import {
  AssignmentMethod,
  AssignmentState,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PoolReclaimConfigDto } from '../leads/dto/pool-reclaim-config.dto';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_CONFIG: Readonly<PoolReclaimConfigDto> = {
  enabled: false,
  reclaimAfterDays: 7,
  excludeStatuses: ['WON', 'INVALID', 'LOST'],
  notifyBeforeDays: 1,
};

const reclaimLeadInclude = {
  assignedUser: { select: { id: true, name: true } },
  currentStatus: { select: { code: true, nameZh: true } },
} satisfies Prisma.LeadInclude;

type ReclaimLead = Prisma.LeadGetPayload<{ include: typeof reclaimLeadInclude }>;

@Injectable()
export class PoolReclaimService {
  private readonly logger = new Logger(PoolReclaimService.name);
  private readonly CONFIG_KEY = 'pool_reclaim_rules';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getConfig(): Promise<PoolReclaimConfigDto> {
    const record = await this.prisma.systemConfig.findUnique({ where: { configKey: this.CONFIG_KEY } });
    if (!record) return this.defaultConfig();
    return this.normalizeConfig(record.configValue as unknown as PoolReclaimConfigDto);
  }

  async saveConfig(config: PoolReclaimConfigDto, updatedById?: string): Promise<PoolReclaimConfigDto> {
    const normalized = this.normalizeConfig(config);
    const validStatusCount = await this.prisma.leadStatus.count({
      where: { code: { in: normalized.excludeStatuses }, isActive: true },
    });
    if (validStatusCount !== new Set(normalized.excludeStatuses).size) {
      throw new BadRequestException('排除状态中包含不存在或已停用的状态');
    }
    const saved = await this.prisma.systemConfig.upsert({
      where: { configKey: this.CONFIG_KEY },
      update: { configValue: normalized as unknown as Prisma.InputJsonValue, updatedById },
      create: {
        configKey: this.CONFIG_KEY,
        configValue: normalized as unknown as Prisma.InputJsonValue,
        description: '公海回收规则配置',
        updatedById,
      },
    });
    return saved.configValue as unknown as PoolReclaimConfigDto;
  }

  @Cron('0 0 2 * * *', { name: 'pool-reclaim', timeZone: 'Asia/Shanghai' })
  async executeReclaim() {
    this.logger.log('开始执行公海回收任务');
    try {
      const config = await this.getConfig();
      if (!config.enabled) return;
      const thresholdDate = this.daysAgo(config.reclaimAfterDays);
      const leadsToReclaim = await this.prisma.lead.findMany({
        where: this.reclaimableWhere(config, thresholdDate),
        include: reclaimLeadInclude,
      });

      let reclaimed = 0;
      const reclaimedLeads: ReclaimLead[] = [];
      for (const lead of leadsToReclaim) {
        try {
          const changed = await this.reclaimIfStillAssigned(
            lead,
            `公海自动回收：超过${config.reclaimAfterDays}天未跟进`,
          );
          if (changed) {
            reclaimed++;
            reclaimedLeads.push(lead);
          }
        } catch (error) {
          this.logger.warn(`回收线索${lead.leadNumber}失败: ${this.errorMessage(error)}`);
        }
      }

      await this.notifyReclaim(reclaimed, reclaimedLeads).catch((error: unknown) => {
        this.logger.warn(`公海回收通知失败: ${this.errorMessage(error)}`);
      });
      this.logger.log(`公海回收完成，共回收${reclaimed}/${leadsToReclaim.length}条线索`);
    } catch (error) {
      this.logger.error(`公海回收任务失败: ${this.errorMessage(error)}`);
    }
  }

  @Cron('0 30 9 * * *', { name: 'pool-reclaim-warning', timeZone: 'Asia/Shanghai' })
  async notifyUpcomingReclaim() {
    try {
      const config = await this.getConfig();
      if (!config.enabled || config.notifyBeforeDays <= 0) return;
      const warningDate = this.daysAgo(Math.max(0, config.reclaimAfterDays - config.notifyBeforeDays));
      const reclaimDate = this.daysAgo(config.reclaimAfterDays);
      const leads = await this.prisma.lead.findMany({
        where: {
          archivedAt: null,
          assignedUserId: { not: null },
          assignmentState: AssignmentState.ASSIGNED,
          currentStatus: { isTerminal: false, code: { notIn: config.excludeStatuses } },
          OR: [
            { lastFollowedUpAt: { gte: reclaimDate, lt: warningDate } },
            { lastFollowedUpAt: null, createdAt: { gte: reclaimDate, lt: warningDate } },
          ],
        },
        include: reclaimLeadInclude,
      });
      if (leads.length) await this.notifyUpcoming(leads, config.notifyBeforeDays);
    } catch (error) {
      this.logger.warn(`公海回收预警失败: ${this.errorMessage(error)}`);
    }
  }

  async reclaimLead(leadId: string, actorId: string, reason?: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, include: reclaimLeadInclude });
    if (!lead) throw new NotFoundException('客户不存在');
    if (!lead.assignedUserId) throw new BadRequestException('客户未分配，无需回收');
    const changed = await this.reclaimIfStillAssigned(lead, reason || '手动回收到公海', actorId);
    if (!changed) throw new ConflictException('客户负责人已变化，请刷新后重试');
    return { success: true, leadId };
  }

  async claimLead(leadId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, role: UserRole.SALES, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    if (!user) throw new BadRequestException('当前账号不是可用销售账号');

    await this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id: leadId }, select: { id: true, assignedUserId: true } });
      if (!lead) throw new NotFoundException('客户不存在');
      if (lead.assignedUserId) throw new ConflictException('客户已被分配');
      const updated = await tx.lead.updateMany({
        where: { id: leadId, assignedUserId: null, archivedAt: null },
        data: { assignedUserId: userId, assignmentState: AssignmentState.ASSIGNED },
      });
      if (!updated.count) throw new ConflictException('客户已被其他销售领取');
      await tx.leadAssignment.create({
        data: {
          leadId,
          toUserId: userId,
          assignmentMethod: AssignmentMethod.MANUAL,
          assignmentReason: '从公海领取',
          assignedById: userId,
        },
      });
      await tx.auditLog.create({
        data: { userId, action: 'CLAIM_FROM_POOL', entityType: 'LEAD', entityId: leadId },
      });
    });
    return { success: true, leadId, userId };
  }

  private async reclaimIfStillAssigned(lead: ReclaimLead, reason: string, actorId?: string) {
    if (!lead.assignedUserId) return false;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.updateMany({
        where: { id: lead.id, assignedUserId: lead.assignedUserId, archivedAt: null },
        data: { assignedUserId: null, assignmentState: AssignmentState.UNASSIGNED },
      });
      if (!updated.count) return false;
      await tx.leadAssignment.create({
        data: {
          leadId: lead.id,
          fromUserId: lead.assignedUserId,
          toUserId: null,
          assignmentMethod: actorId ? AssignmentMethod.MANUAL : AssignmentMethod.AUTOMATIC,
          assignmentReason: reason,
          assignedById: actorId,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: actorId ? 'MANUAL_POOL_RECLAIM' : 'POOL_RECLAIM',
          entityType: 'LEAD',
          entityId: lead.id,
          beforeData: {
            assignedUserId: lead.assignedUserId,
            salesName: lead.assignedUser?.name,
          } as Prisma.InputJsonValue,
          afterData: { assignedUserId: null, reason } as Prisma.InputJsonValue,
        },
      });
      return true;
    });
  }

  private reclaimableWhere(config: PoolReclaimConfigDto, thresholdDate: Date): Prisma.LeadWhereInput {
    return {
      archivedAt: null,
      assignedUserId: { not: null },
      assignmentState: AssignmentState.ASSIGNED,
      currentStatus: { isTerminal: false, code: { notIn: config.excludeStatuses } },
      OR: [
        { lastFollowedUpAt: { lt: thresholdDate } },
        { lastFollowedUpAt: null, createdAt: { lt: thresholdDate } },
      ],
    };
  }

  private async notifyReclaim(count: number, leads: ReclaimLead[]) {
    if (!count) return;
    const lines = ['🔄 公海回收通知', `共回收 ${count} 条超时未跟进线索`, '', '按销售分布:'];
    const bySales = this.countBySales(leads);
    for (const [name, total] of bySales) lines.push(`• ${name}: ${total} 条`);
    lines.push('', '线索已回收到公海，可重新分配');
    await this.sendWeChat(lines.join('\n'));
  }

  private async notifyUpcoming(leads: ReclaimLead[], days: number) {
    const lines = ['⚠️ 公海回收预警', `${leads.length} 条线索将在 ${days} 天内被回收`, '', '按销售分布:'];
    for (const [name, total] of this.countBySales(leads)) lines.push(`• ${name}: ${total} 条`);
    lines.push('', '请尽快跟进并填写跟进记录');
    await this.sendWeChat(lines.join('\n'));
  }

  private countBySales(leads: ReclaimLead[]) {
    const result = new Map<string, number>();
    for (const lead of leads) {
      const name = lead.assignedUser?.name || '未知';
      result.set(name, (result.get(name) || 0) + 1);
    }
    return result;
  }

  private async sendWeChat(content: string) {
    const webhookUrl = this.config.get<string>('WECHAT_WEBHOOK_URL');
    if (!webhookUrl) return;
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'text', text: { content } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  }

  private normalizeConfig(config: PoolReclaimConfigDto): PoolReclaimConfigDto {
    return {
      enabled: Boolean(config.enabled),
      reclaimAfterDays: config.reclaimAfterDays,
      excludeStatuses: [...new Set(config.excludeStatuses.map((status) => status.toUpperCase()))],
      notifyBeforeDays: Math.min(config.notifyBeforeDays, config.reclaimAfterDays),
    };
  }

  private defaultConfig(): PoolReclaimConfigDto {
    return { ...DEFAULT_CONFIG, excludeStatuses: [...DEFAULT_CONFIG.excludeStatuses] };
  }

  private daysAgo(days: number) {
    return new Date(Date.now() - days * 86_400_000);
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
