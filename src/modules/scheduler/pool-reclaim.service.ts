import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AssignmentState, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface PoolReclaimConfig {
  enabled: boolean;
  reclaimAfterDays: number;
  excludeStatuses: string[];
  notifyBeforeDays: number;
}

const DEFAULT_CONFIG: PoolReclaimConfig = {
  enabled: false,
  reclaimAfterDays: 7,
  excludeStatuses: ['WON', 'INVALID', 'LOST'],
  notifyBeforeDays: 1,
};

@Injectable()
export class PoolReclaimService {
  private readonly logger = new Logger(PoolReclaimService.name);
  private readonly CONFIG_KEY = 'pool_reclaim_rules';

  constructor(private readonly prisma: PrismaService) {}

  async getConfig(): Promise<PoolReclaimConfig> {
    const record = await this.prisma.systemConfig.findUnique({
      where: { configKey: this.CONFIG_KEY },
    });
    if (!record) return DEFAULT_CONFIG;
    return record.configValue as unknown as PoolReclaimConfig;
  }

  async saveConfig(config: PoolReclaimConfig, updatedById?: string): Promise<PoolReclaimConfig> {
    const saved = await this.prisma.systemConfig.upsert({
      where: { configKey: this.CONFIG_KEY },
      update: {
        configValue: config as unknown as Prisma.InputJsonValue,
        updatedById,
      },
      create: {
        configKey: this.CONFIG_KEY,
        configValue: config as unknown as Prisma.InputJsonValue,
        description: '公海回收规则配置',
        updatedById,
      },
    });
    return saved.configValue as unknown as PoolReclaimConfig;
  }

  // 每天凌晨2点执行公海回收
  @Cron('0 0 2 * * *', { name: 'pool-reclaim' })
  async executeReclaim() {
    this.logger.log('开始执行公海回收任务');
    try {
      const config = await this.getConfig();
      if (!config.enabled) {
        this.logger.log('公海回收未启用，跳过');
        return;
      }

      const now = new Date();
      const thresholdDate = new Date(now.getTime() - config.reclaimAfterDays * 24 * 60 * 60 * 1000);

      // 查询需要回收的线索
      const leadsToReclaim = await this.prisma.lead.findMany({
        where: {
          archivedAt: null,
          assignedUserId: { not: null },
          assignmentState: AssignmentState.ASSIGNED,
          currentStatus: {
            isTerminal: false,
            code: { notIn: config.excludeStatuses },
          },
          OR: [
            { lastFollowedUpAt: { lt: thresholdDate } },
            { lastFollowedUpAt: null, createdAt: { lt: thresholdDate } },
          ],
        },
        include: {
          assignedUser: { select: { id: true, name: true } },
          currentStatus: { select: { code: true, nameZh: true } },
        },
      });

      if (leadsToReclaim.length === 0) {
        this.logger.log('无需要回收的线索');
        return;
      }

      // 执行回收
      let reclaimed = 0;
      for (const lead of leadsToReclaim) {
        try {
          await this.prisma.$transaction([
            this.prisma.lead.update({
              where: { id: lead.id },
              data: {
                assignedUserId: null,
                assignmentState: AssignmentState.UNASSIGNED,
              },
            }),
            this.prisma.leadAssignment.create({
              data: {
                leadId: lead.id,
                fromUserId: lead.assignedUserId!,
                toUserId: lead.assignedUserId!, // 临时占位，实际是回收到公海
                assignmentMethod: 'AUTOMATIC' as any,
                assignmentReason: `公海自动回收：超过${config.reclaimAfterDays}天未跟进`,
              },
            }),
            this.prisma.auditLog.create({
              data: {
                action: 'POOL_RECLAIM',
                entityType: 'LEAD',
                entityId: lead.id,
                beforeData: { assignedUserId: lead.assignedUserId, salesName: lead.assignedUser?.name } as Prisma.InputJsonValue,
                afterData: { assignedUserId: null, reason: '公海回收' } as Prisma.InputJsonValue,
              },
            }),
          ]);
          reclaimed++;
        } catch (error) {
          this.logger.warn(`回收线索${lead.leadNumber}失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // 推送通知
      await this.notifyReclaim(reclaimed, leadsToReclaim).catch((err) => {
        this.logger.warn(`公海回收通知失败: ${err.message}`);
      });

      this.logger.log(`公海回收完成，共回收${reclaimed}/${leadsToReclaim.length}条线索`);
    } catch (error) {
      this.logger.error(`公海回收任务失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 手动回收单条线索
  async reclaimLead(leadId: string, actorId: string, reason?: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new Error('客户不存在');
    if (!lead.assignedUserId) throw new Error('客户未分配，无需回收');

    await this.prisma.$transaction([
      this.prisma.lead.update({
        where: { id: leadId },
        data: { assignedUserId: null, assignmentState: AssignmentState.UNASSIGNED },
      }),
      this.prisma.leadAssignment.create({
        data: {
          leadId,
          fromUserId: lead.assignedUserId,
          toUserId: lead.assignedUserId,
          assignmentMethod: 'MANUAL' as any,
          assignmentReason: reason || '手动回收到公海',
          assignedById: actorId,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: actorId,
          action: 'MANUAL_POOL_RECLAIM',
          entityType: 'LEAD',
          entityId: leadId,
        },
      }),
    ]);

    return { success: true, leadId };
  }

  // 管理员手动领取公海线索
  async claimLead(leadId: string, userId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new Error('客户不存在');
    if (lead.assignedUserId) throw new Error('客户已被分配');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.SALES) throw new Error('用户不是销售');

    await this.prisma.$transaction([
      this.prisma.lead.update({
        where: { id: leadId },
        data: { assignedUserId: userId, assignmentState: AssignmentState.ASSIGNED },
      }),
      this.prisma.leadAssignment.create({
        data: {
          leadId,
          toUserId: userId,
          assignmentMethod: 'MANUAL' as any,
          assignmentReason: '从公海领取',
          assignedById: userId,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          userId,
          action: 'CLAIM_FROM_POOL',
          entityType: 'LEAD',
          entityId: leadId,
        },
      }),
    ]);

    return { success: true, leadId, userId };
  }

  private async notifyReclaim(count: number, leads: any[]) {
    const webhookUrl = process.env.WECHAT_WEBHOOK_URL;
    if (!webhookUrl || count === 0) return;

    const bySales = new Map<string, number>();
    for (const lead of leads) {
      const name = lead.assignedUser?.name || '未知';
      bySales.set(name, (bySales.get(name) || 0) + 1);
    }

    const lines = [
      '🔄 公海回收通知',
      `共回收 ${count} 条超时未跟进线索`,
      '',
      '按销售分布:',
    ];
    for (const [name, c] of bySales) {
      lines.push(`• ${name}: ${c} 条`);
    }
    lines.push('', '线索已回收到公海，可重新分配');

    const content = lines.join('\n');
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'text', text: { content } }),
    });
  }
}
