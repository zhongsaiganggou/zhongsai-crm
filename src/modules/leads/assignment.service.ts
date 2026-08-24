import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AssignmentMethod,
  AssignmentState,
  ChannelCapability,
  CommunicationMethod,
  Prisma,
  ProjectType,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignmentConfigDto, AssignmentRuleDto } from './dto/assignment-config.dto';

const DEFAULT_CONFIG: Readonly<AssignmentConfigDto> = {
  enabled: false,
  mode: 'load_balance',
  rules: [],
  roundRobinIndex: 0,
};

@Injectable()
export class AssignmentService {
  private readonly CONFIG_KEY = 'assignment_rules';

  constructor(private readonly prisma: PrismaService) {}

  async getConfig(): Promise<AssignmentConfigDto> {
    const record = await this.prisma.systemConfig.findUnique({
      where: { configKey: this.CONFIG_KEY },
    });
    if (!record) return this.defaultConfig();
    return this.normalizeConfig(record.configValue as unknown as AssignmentConfigDto);
  }

  async saveConfig(config: AssignmentConfigDto, updatedById?: string): Promise<AssignmentConfigDto> {
    const normalized = this.normalizeConfig(config);
    const referencedUserIds = new Set([
      ...normalized.rules.map((rule) => rule.userId),
      ...(normalized.defaultUserId ? [normalized.defaultUserId] : []),
    ]);
    if (referencedUserIds.size) {
      const validUsers = await this.prisma.user.count({
        where: {
          id: { in: [...referencedUserIds] },
          role: UserRole.SALES,
          status: UserStatus.ACTIVE,
        },
      });
      if (validUsers !== referencedUserIds.size) {
        throw new BadRequestException('分配规则包含无效或已停用的销售账号');
      }
    }

    const saved = await this.prisma.systemConfig.upsert({
      where: { configKey: this.CONFIG_KEY },
      update: { configValue: normalized as unknown as Prisma.InputJsonValue, updatedById },
      create: {
        configKey: this.CONFIG_KEY,
        configValue: normalized as unknown as Prisma.InputJsonValue,
        description: '线索自动分配规则配置',
        updatedById,
      },
    });
    return saved.configValue as unknown as AssignmentConfigDto;
  }

  async autoAssign(
    leadId: string,
    actorId?: string,
  ): Promise<{ assigned: boolean; userId?: string; reason?: string }> {
    const config = await this.getConfig();
    if (!config.enabled) return { assigned: false, reason: '自动分配未启用' };

    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('客户不存在');
    if (lead.assignedUserId) {
      return { assigned: false, userId: lead.assignedUserId, reason: '客户已有负责人' };
    }
    if (lead.requiresReview || lead.contactAvailability === 'NONE') {
      await this.prisma.lead.update({
        where: { id: leadId },
        data: { assignmentState: AssignmentState.REVIEW_REQUIRED },
      });
      return { assigned: false, reason: '客户需要人工核查' };
    }

    let targetUserId = this.matchRule(config.rules, lead);
    if (targetUserId && !(await this.isAvailableSales(targetUserId))) targetUserId = undefined;

    if (!targetUserId) {
      if (config.mode === 'round_robin') {
        targetUserId = await this.roundRobinAssign(config);
      } else if (config.mode === 'load_balance') {
        targetUserId = await this.loadBalanceAssign(lead.preferredChannel);
      }
    }

    if (!targetUserId && config.defaultUserId && await this.isAvailableSales(config.defaultUserId)) {
      targetUserId = config.defaultUserId;
    }
    if (!targetUserId) return { assigned: false, reason: '没有符合条件的可用销售' };

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.updateMany({
        where: { id: leadId, assignedUserId: null },
        data: { assignedUserId: targetUserId, assignmentState: AssignmentState.ASSIGNED },
      });
      if (updated.count === 0) throw new BadRequestException('客户已被其他销售领取');
      await tx.leadAssignment.create({
        data: {
          leadId,
          fromUserId: null,
          toUserId: targetUserId,
          assignmentMethod: AssignmentMethod.AUTOMATIC,
          assignmentReason: `自动分配（${config.mode}）`,
          assignedById: actorId,
        },
      });
    });

    return { assigned: true, userId: targetUserId };
  }

  private matchRule(
    rules: AssignmentRuleDto[],
    lead: { countryCode: string | null; projectType: ProjectType | null },
  ): string | undefined {
    for (const rule of rules) {
      if (rule.type === 'country' && rule.countries && lead.countryCode) {
        if (rule.countries.includes(lead.countryCode.toUpperCase())) return rule.userId;
      }
      if (rule.type === 'project_type' && rule.projectTypes && lead.projectType) {
        if (rule.projectTypes.includes(lead.projectType)) return rule.userId;
      }
    }
    return undefined;
  }

  private async roundRobinAssign(config: AssignmentConfigDto): Promise<string | undefined> {
    return this.prisma.$transaction(async (tx) => {
      const sales = await tx.user.findMany({
        where: { role: UserRole.SALES, status: UserStatus.ACTIVE },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!sales.length) return undefined;

      const record = await tx.systemConfig.findUnique({ where: { configKey: this.CONFIG_KEY } });
      const latest = record
        ? this.normalizeConfig(record.configValue as unknown as AssignmentConfigDto)
        : this.normalizeConfig(config);
      const index = latest.roundRobinIndex % sales.length;
      latest.roundRobinIndex = (index + 1) % sales.length;
      await tx.systemConfig.upsert({
        where: { configKey: this.CONFIG_KEY },
        update: { configValue: latest as unknown as Prisma.InputJsonValue },
        create: {
          configKey: this.CONFIG_KEY,
          configValue: latest as unknown as Prisma.InputJsonValue,
          description: '线索自动分配规则配置',
        },
      });
      return sales[index].id;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async loadBalanceAssign(preferredChannel: CommunicationMethod | null): Promise<string | undefined> {
    const capability = this.channelToCapability(preferredChannel);
    const select = {
      id: true,
      _count: {
        select: {
          assignedLeads: { where: { archivedAt: null, currentStatus: { isTerminal: false } } },
        },
      },
    } satisfies Prisma.UserSelect;

    let candidates = await this.prisma.user.findMany({
      where: {
        role: UserRole.SALES,
        status: UserStatus.ACTIVE,
        ...(capability ? { channelCapabilities: { has: capability } } : {}),
      },
      select,
    });
    if (!candidates.length && capability) {
      candidates = await this.prisma.user.findMany({
        where: { role: UserRole.SALES, status: UserStatus.ACTIVE },
        select,
      });
    }
    candidates.sort((left, right) => left._count.assignedLeads - right._count.assignedLeads);
    return candidates[0]?.id;
  }

  private isAvailableSales(userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, role: UserRole.SALES, status: UserStatus.ACTIVE },
      select: { id: true },
    }).then(Boolean);
  }

  private normalizeConfig(config: AssignmentConfigDto): AssignmentConfigDto {
    return {
      enabled: Boolean(config.enabled),
      mode: config.mode,
      rules: (config.rules ?? []).map((rule) => ({
        ...rule,
        countries: rule.countries?.map((country) => country.toUpperCase()),
      })),
      defaultUserId: config.defaultUserId || undefined,
      roundRobinIndex: Number.isInteger(config.roundRobinIndex) && config.roundRobinIndex >= 0
        ? config.roundRobinIndex
        : 0,
    };
  }

  private defaultConfig(): AssignmentConfigDto {
    return { ...DEFAULT_CONFIG, rules: [] };
  }

  private channelToCapability(channel: CommunicationMethod | null): ChannelCapability | null {
    if (!channel || channel === CommunicationMethod.REVIEW) return null;
    return channel as unknown as ChannelCapability;
  }
}
