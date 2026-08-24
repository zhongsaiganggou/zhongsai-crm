import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { AssignmentState, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface ReminderLead {
  leadNumber: string;
  name: string | null;
  countryName: string | null;
  nextFollowUpAt: Date | null;
  lastFollowedUpAt: Date | null;
  assignedUser: { name: string } | null;
}

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // 每天早上9点推送今日待跟进提醒
  @Cron('0 0 9 * * *', { name: 'daily-followup-reminder', timeZone: 'Asia/Shanghai' })
  async dailyFollowUpReminder() {
    this.logger.log('开始执行每日跟进提醒任务');
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

      // 查询今天需要跟进的线索
      const dueToday = await this.prisma.lead.findMany({
        where: {
          archivedAt: null,
          nextFollowUpAt: { gte: todayStart, lte: todayEnd },
          assignedUserId: { not: null },
        },
        include: { assignedUser: { select: { id: true, name: true, mobile: true } } },
        orderBy: { nextFollowUpAt: 'asc' },
      });

      if (dueToday.length === 0) {
        this.logger.log('今日无待跟进线索');
        return;
      }

      // 按销售分组
      const bySales = new Map<string, { name: string; leads: typeof dueToday }>();
      for (const lead of dueToday) {
        if (!lead.assignedUser) continue;
        if (!bySales.has(lead.assignedUserId!)) {
          bySales.set(lead.assignedUserId!, { name: lead.assignedUser.name, leads: [] });
        }
        bySales.get(lead.assignedUserId!)!.leads.push(lead);
      }

      // 推送每个销售的待跟进提醒
      for (const data of bySales.values()) {
        await this.notifySales(data.name, data.leads, 'today').catch((err: unknown) => {
          this.logger.warn(`推送销售${data.name}提醒失败: ${this.errorMessage(err)}`);
        });
      }

      // 推送管理员汇总
      await this.notifyAdminSummary(dueToday, 'today').catch((err: unknown) => {
        this.logger.warn(`推送管理员汇总失败: ${this.errorMessage(err)}`);
      });

      this.logger.log(`今日待跟进提醒推送完成，共${dueToday.length}条线索，${bySales.size}位销售`);
    } catch (error) {
      this.logger.error(`每日跟进提醒任务失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 每天早上10点检查超过3天未跟进的线索
  @Cron('0 0 10 * * *', { name: 'overdue-followup-reminder', timeZone: 'Asia/Shanghai' })
  async overdueFollowUpReminder() {
    this.logger.log('开始执行超时未跟进提醒任务');
    try {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      // 查询超过3天未跟进的线索（有分配人，最后跟进时间超过3天或无跟进记录，且不是终态）
      const overdue = await this.prisma.lead.findMany({
        where: {
          archivedAt: null,
          assignedUserId: { not: null },
          assignmentState: AssignmentState.ASSIGNED,
          currentStatus: { isTerminal: false },
          OR: [
            { lastFollowedUpAt: { lt: threeDaysAgo } },
            { lastFollowedUpAt: null },
          ],
          // 排除今天刚分配的
          createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
        include: {
          assignedUser: { select: { id: true, name: true, mobile: true } },
          currentStatus: { select: { nameZh: true } },
        },
        orderBy: { lastFollowedUpAt: 'asc' },
      });

      if (overdue.length === 0) {
        this.logger.log('无超时未跟进线索');
        return;
      }

      // 按销售分组
      const bySales = new Map<string, { name: string; leads: typeof overdue }>();
      for (const lead of overdue) {
        if (!lead.assignedUser) continue;
        if (!bySales.has(lead.assignedUserId!)) {
          bySales.set(lead.assignedUserId!, { name: lead.assignedUser.name, leads: [] });
        }
        bySales.get(lead.assignedUserId!)!.leads.push(lead);
      }

      // 推送每个销售的超时提醒
      for (const data of bySales.values()) {
        await this.notifySales(data.name, data.leads, 'overdue').catch((err: unknown) => {
          this.logger.warn(`推送销售${data.name}超时提醒失败: ${this.errorMessage(err)}`);
        });
      }

      // 推送管理员汇总
      await this.notifyAdminSummary(overdue, 'overdue').catch((err: unknown) => {
        this.logger.warn(`推送管理员超时汇总失败: ${this.errorMessage(err)}`);
      });

      this.logger.log(`超时未跟进提醒推送完成，共${overdue.length}条线索，${bySales.size}位销售`);
    } catch (error) {
      this.logger.error(`超时未跟进提醒任务失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async notifySales(salesName: string, leads: ReminderLead[], type: 'today' | 'overdue') {
    const webhookUrl = this.config.get<string>('WECHAT_WEBHOOK_URL');
    if (!webhookUrl) return;

    const title = type === 'today' ? '📋 今日待跟进提醒' : '⚠️ 超时未跟进提醒';
    const lines = [
      `${title}`,
      `销售: ${salesName}`,
      `共 ${leads.length} 条线索`,
      '',
    ];

    for (const lead of leads.slice(0, 10)) {
      const time = lead.nextFollowUpAt
        ? new Date(lead.nextFollowUpAt).toLocaleDateString('zh-CN')
        : lead.lastFollowedUpAt
          ? `上次: ${new Date(lead.lastFollowedUpAt).toLocaleDateString('zh-CN')}`
          : '从未跟进';
      lines.push(`• ${lead.leadNumber} | ${lead.name || '匿名'} | ${lead.countryName || '未知'} | ${time}`);
    }

    if (leads.length > 10) {
      lines.push(`... 还有 ${leads.length - 10} 条`);
    }

    lines.push('', '请及时登录CRM处理');

    const content = lines.join('\n');
    await this.sendWeChat(webhookUrl, content);
  }

  private async notifyAdminSummary(leads: ReminderLead[], type: 'today' | 'overdue') {
    const webhookUrl = this.config.get<string>('WECHAT_WEBHOOK_URL');
    if (!webhookUrl) return;

    // 查询管理员
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
      select: { name: true },
    });

    const title = type === 'today' ? '📊 今日待跟进汇总（管理员）' : '🚨 超时未跟进汇总（管理员）';
    const bySales = new Map<string, number>();
    for (const lead of leads) {
      const name = lead.assignedUser?.name || '未分配';
      bySales.set(name, (bySales.get(name) || 0) + 1);
    }

    const lines = [
      title,
      `总计: ${leads.length} 条线索`,
      `管理员: ${admins.map((a) => a.name).join(', ')}`,
      '',
      '按销售分布:',
    ];

    for (const [name, count] of bySales) {
      lines.push(`• ${name}: ${count} 条`);
    }

    const content = lines.join('\n');
    await this.sendWeChat(webhookUrl, content);
  }

  private async sendWeChat(webhookUrl: string, content: string) {
    const body = JSON.stringify({
      msgtype: 'text',
      text: { content },
    });

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
