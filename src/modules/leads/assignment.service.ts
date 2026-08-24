import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AssignmentMethod, AssignmentState, Prisma, ProjectType, UserRole, UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AssignmentRule {
  type: 'country' | 'project_type';
  countries?: string[];
  projectTypes?: ProjectType[];
  userId: string;
}

export interface AssignmentConfig {
  enabled: boolean;
  mode: 'round_robin' | 'load_balance' | 'rule_based';
  rules: AssignmentRule[];
  defaultUserId?: string;
  roundRobinIndex: number;
}

const DEFAULT_CONFIG: AssignmentConfig = {
  enabled: false,
  mode: 'load_balance',
  rules: [],
  roundRobinIndex: 0,
};

@Injectable()
export class AssignmentService {
  private readonly CONFIG_KEY = 'assignment_rules';

  constructor(private readonly prisma: PrismaService) {}

  async getConfig(): Promise<AssignmentConfig> {
    const record = await this.prisma.systemConfig.findUnique({
      where: { configKey: this.CONFIG_KEY },
    });
    if (!record) return DEFAULT_CONFIG;
    return record.configValue as unknown as AssignmentConfig;
  }

  async saveConfig(config: AssignmentConfig, updatedById?: string): Promise<AssignmentConfig> {
    // 验证规则中的用户ID
    for (const rule of config.rules) {
      const user = await this.prisma.user.findUnique({ where: { id: rule.userId } });
      if (!user || user.role !== UserRole.SALES || user.status !== UserStatus.ACTIVE) {
        throw new BadRequestException(`规则中的销售用户无效: ${rule.userId}`);
      }
    }
    if (config.defaultUserId) {
      const user = await this.prisma.user.findUnique({ where: { id: config.defaultUserId } });
      if (!user || user.role !== UserRole.SALES || user.status !== UserStatus.ACTIVE) {
        throw new BadRequestException('默认销售用户无效');
      }
    }

    const saved = await this.prisma.systemConfig.upsert({
      where: { configKey: this.CONFIG_KEY },
      update: {
        configValue: config as unknown as Prisma.InputJsonValue,
        updatedById,
      },
      create: {
        configKey: this.CONFIG_KEY,
        configValue: config as unknown as Prisma.InputJsonValue,
        description: '线索自动分配规则配置',
        updatedById,
      },
    });
    return saved.configValue as unknown as AssignmentConfig;
  }

  async autoAssign(leadId: string, actorId?: string): Promise<{ assigned: boolean; userId?: string; reason?: string }> {
    const config = await this.getConfig();
    if (!config.enabled) {
      return { assigned: false, reason: '自动分配未启用' };
    }

    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('客户不存在');
    if (lead.requiresReview || lead.contactAvailability === 'NONE') {
      await this.prisma.lead.update({
        where: { id: leadId },
        data: { assignmentState: AssignmentState.REVIEW_REQUIRED },
      });
      return { assigned: false, reason: '客户需要人工核查' };
    }

    let targetUserId: string | undefined;

    // 规则匹配
    if (config.mode === 'rule_based' || config.rules.length > 0) {
      targetUserId = this.matchRule(config.rules, lead);
    }

    // 轮询分配
    if (!targetUserId && config.mode === 'round_robin') {
      targetUserId = await this.roundRobinAssign(config);
    }

    // 负载均衡分配
    if (!targetUserId && (config.mode === 'load_balance' || !targetUserId)) {
      targetUserId = await this.loadBalanceAssign(lead.preferredChannel);
    }

    // 默认分配
    if (!targetUserId && config.defaultUserId) {
      targetUserId = config.defaultUserId;
    }

    if (!targetUserId) {
      return { assigned: false, reason: '没有符合条件的可用销售' };
    }

    await this.prisma.$transaction([
      this.prisma.lead.update({
        where: { id: leadId },
        data: { assignedUserId: targetUserId, assignmentState: AssignmentState.ASSIGNED },
      }),
      this.prisma.leadAssignment.create({
        data: {
          leadId,
          fromUserId: lead.assignedUserId,
          toUserId: targetUserId,
          assignmentMethod: AssignmentMethod.AUTOMATIC,
          assignmentReason: `自动分配（${config.mode}）`,
          assignedById: actorId,
        },
      }),
    ]);

    return { assigned: true, userId: targetUserId };
  }

  private matchRule(rules: AssignmentRule[], lead: { countryCode: string | null; projectType: ProjectType | null }): string | undefined {
    for (const rule of rules) {
      if (rule.type === 'country' && rule.countries && lead.countryCode) {
        if (rule.countries.includes(lead.countryCode)) return rule.userId;
      }
      if (rule.type === 'project_type' && rule.projectTypes && lead.projectType) {
        if (rule.projectTypes.includes(lead.projectType)) return rule.userId;
      }
    }
    return undefined;
  }

  private async roundRobinAssign(config: AssignmentConfig): Promise<string | undefined> {
    const sales = await this.prisma.user.findMany({
      where: { role: UserRole.SALES, status: UserStatus.ACTIVE },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (sales.length === 0) return undefined;

    const index = config.roundRobinIndex % sales.length;
    const target = sales[index];

    // 更新轮询索引
    config.roundRobinIndex = (index + 1) % sales.length;
    await this.prisma.systemConfig.upsert({
      where: { configKey: this.CONFIG_KEY },
      update: { configValue: config as unknown as Prisma.InputJsonValue },
      create: {
        configKey: this.CONFIG_KEY,
        configValue: config as unknown as Prisma.InputJsonValue,
        description: '线索自动分配规则配置',
      },
    });

    return target.id;
  }

  private async loadBalanceAssign(preferredChannel: string | null): Promise<string | undefined> {
    const capability = preferredChannel === 'WHATSAPP' ? 'WHATSAPP'
      : preferredChannel === 'WECHAT' ? 'WECHAT'
      : preferredChannel === 'PHONE' ? 'PHONE'
      : preferredChannel === 'EMAIL' ? 'EMAIL'
      : null;

    const candidates = await this.prisma.user.findMany({
      where: {
        role: UserRole.SALES,
        status: UserStatus.ACTIVE,
        ...(capability ? { channelCapabilities: { has: capability } } : {}),
      },
      select: {
        id: true,
        _count: {
          select: {
            assignedLeads: {
              where: { archivedAt: null, currentStatus: { isTerminal: false } },
            },
          },
        },
      },
    });
    if (candidates.length === 0) return undefined;
    candidates.sort((a, b) => a._count.assignedLeads - b._count.assignedLeads);
    return candidates[0].id;
  }
}
