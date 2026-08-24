import { Injectable } from '@nestjs/common';
import { LeadQualityFlag, Prisma, UserRole } from '@prisma/client';
import { AuthUser } from '../../common/types/auth-user.type';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(user: AuthUser) {
    const base: Prisma.LeadWhereInput = { archivedAt: null, ...(user.role === UserRole.SALES ? { assignedUserId: user.id } : {}) };
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000);
    const [total, today, due, overdueThreeDays, bySource, byQuality, statuses] = await Promise.all([
      this.prisma.lead.count({ where: base }),
      this.prisma.lead.count({ where: { ...base, createdAt: { gte: startOfToday } } }),
      this.prisma.lead.count({ where: { ...base, nextFollowUpAt: { lte: new Date() }, currentStatus: { isTerminal: false } } }),
      this.prisma.lead.count({ where: { ...base, currentStatus: { isTerminal: false }, OR: [{ lastFollowedUpAt: { lt: threeDaysAgo } }, { lastFollowedUpAt: null, createdAt: { lt: threeDaysAgo } }] } }),
      this.prisma.lead.groupBy({ by: ['sourceType'], where: base, _count: true }),
      this.prisma.lead.groupBy({ by: ['qualityFlag'], where: base, _count: true }),
      this.prisma.leadStatus.findMany({ where: { isActive: true }, include: { _count: { select: { currentLeads: { where: base } } } }, orderBy: { sortOrder: 'asc' } }),
    ]);
    const invalidFlags = new Set<LeadQualityFlag>([
      LeadQualityFlag.SUSPECTED_SPAM,
      LeadQualityFlag.CONFIRMED_INVALID,
    ]);
    const invalid = byQuality
      .filter((item) => invalidFlags.has(item.qualityFlag))
      .reduce((sum, item) => sum + item._count, 0);
    return { total, today, due, overdueThreeDays, valid: total - invalid, bySource, byQuality, byStatus: statuses.map((status) => ({ id: status.id, code: status.code, nameZh: status.nameZh, count: status._count.currentLeads })) };
  }

  async ads() {
    const [campaigns, ads, forms, countries] = await Promise.all([
      this.prisma.leadAttribution.groupBy({ by: ['platform', 'campaignId', 'campaignName'], _count: true, orderBy: { _count: { campaignId: 'desc' } }, take: 100 }),
      this.prisma.leadAttribution.groupBy({ by: ['platform', 'adId', 'adName'], _count: true, orderBy: { _count: { adId: 'desc' } }, take: 100 }),
      this.prisma.leadAttribution.groupBy({ by: ['platform', 'formId', 'formName'], _count: true, orderBy: { _count: { formId: 'desc' } }, take: 100 }),
      this.prisma.lead.groupBy({ by: ['countryCode', 'countryName'], where: { archivedAt: null }, _count: true, orderBy: { _count: { countryCode: 'desc' } }, take: 100 }),
    ]);
    return { campaigns, ads, forms, countries };
  }
}
