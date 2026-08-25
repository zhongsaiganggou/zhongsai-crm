import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AssignmentMethod, AssignmentState, LeadQualityFlag,
  Prisma, UserRole, UserStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuthUser } from '../../common/types/auth-user.type';
import { evaluateContacts } from '../../common/utils/contact.util';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { ReviewLeadDto } from './dto/review-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

const leadInclude = {
  currentStatus: true,
  assignedUser: { select: { id: true, name: true, mobile: true } },
  attributions: { orderBy: { createdAt: 'desc' as const } },
  tags: { include: { tag: true }, orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.LeadInclude;

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  getStatuses() {
    return this.prisma.leadStatus.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  }

  async findAll(user: AuthUser, query: QueryLeadsDto) {
    const where: Prisma.LeadWhereInput = {
      archivedAt: null,
      ...(user.role === UserRole.SALES ? { assignedUserId: user.id } : {}),
      ...(query.statusId ? { currentStatusId: query.statusId } : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.qualityFlag ? { qualityFlag: query.qualityFlag } : {}),
      ...(query.assignmentState ? { assignmentState: query.assignmentState } : {}),
      ...(query.assignedUserId && user.role === UserRole.ADMIN ? { assignedUserId: query.assignedUserId } : {}),
      ...(query.countryCode ? { countryCode: query.countryCode.toUpperCase() } : {}),
      ...(query.requiresReview !== undefined ? { requiresReview: query.requiresReview } : {}),
      ...(query.tagId ? { tags: { some: { tagId: query.tagId } } } : {}),
      ...(query.overdue ? { nextFollowUpAt: { lt: new Date() } } : {}),
      ...((query.createdFrom || query.createdTo) ? {
        createdAt: {
          ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
          ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
        },
      } : {}),
      ...(query.search ? {
        OR: [
          { leadNumber: { contains: query.search, mode: 'insensitive' } },
          { name: { contains: query.search, mode: 'insensitive' } },
          { companyName: { contains: query.search, mode: 'insensitive' } },
          { wechatId: { contains: query.search, mode: 'insensitive' } },
          { phoneRaw: { contains: query.search } },
          { whatsappRaw: { contains: query.search } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      } : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({ where, include: leadInclude, orderBy: { createdAt: 'desc' }, skip, take: query.pageSize }),
      this.prisma.lead.count({ where }),
    ]);
    return { items, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async findOne(user: AuthUser, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, archivedAt: null, ...(user.role === UserRole.SALES ? { assignedUserId: user.id } : {}) },
      include: {
        ...leadInclude,
        followUps: { include: { user: { select: { id: true, name: true } } }, orderBy: { followedUpAt: 'desc' } },
        statusHistory: { include: { fromStatus: true, toStatus: true, changedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
        assignments: { include: { fromUser: { select: { id: true, name: true } }, toUser: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!lead) throw new NotFoundException('客户不存在或无权查看');
    return lead;
  }

  async createManual(user: AuthUser, dto: CreateLeadDto) {
    const status = await this.prisma.leadStatus.findUnique({ where: { code: 'NEW' } });
    if (!status) throw new BadRequestException('客户状态初始化未完成');
    const contact = evaluateContacts({ wechatId: dto.wechatId, whatsappRaw: dto.whatsapp, phoneRaw: dto.phone, email: dto.email });
    const duplicate = await this.findPossibleDuplicate(contact, dto.wechatId);
    const qualityFlag = duplicate ? LeadQualityFlag.POSSIBLE_DUPLICATE : contact.qualityFlag;
    const assignedUserId = user.role === UserRole.SALES ? user.id : dto.assignedUserId;
    const lead = await this.prisma.lead.create({
      data: {
        leadNumber: this.generateLeadNumber(), name: dto.name?.trim() || null,
        countryCode: dto.countryCode?.toUpperCase(), countryName: dto.countryName?.trim(), city: dto.city?.trim(),
        companyName: dto.companyName?.trim(), jobTitle: dto.jobTitle?.trim(), wechatId: dto.wechatId?.trim(),
        whatsappRaw: dto.whatsapp?.trim(), phoneRaw: dto.phone?.trim(), email: dto.email?.trim(), ...contact,
        projectType: dto.projectType, projectDescription: dto.projectDescription, purchaseTimeline: dto.purchaseTimeline,
        expectedPurchaseDate: dto.expectedPurchaseDate ? new Date(dto.expectedPurchaseDate) : undefined,
        estimatedBudget: dto.estimatedBudget, budgetCurrency: dto.budgetCurrency?.toUpperCase(), remark: dto.remark,
        sourceType: dto.sourceType, currentStatusId: status.id, createdById: user.id,
        assignedUserId, assignmentState: assignedUserId ? AssignmentState.ASSIGNED : contact.requiresReview ? AssignmentState.REVIEW_REQUIRED : AssignmentState.UNASSIGNED,
        qualityFlag, requiresReview: contact.requiresReview || Boolean(duplicate),
        attributions: { create: { platform: dto.sourceType, isPrimary: true } },
      },
      include: leadInclude,
    });
    if (assignedUserId) {
      await this.prisma.leadAssignment.create({
        data: { leadId: lead.id, toUserId: assignedUserId, assignmentMethod: AssignmentMethod.MANUAL, assignmentReason: '创建客户时分配', assignedById: user.id },
      });
    }
    await this.prisma.auditLog.create({ data: { userId: user.id, action: 'CREATE_LEAD', entityType: 'LEAD', entityId: lead.id } });
    return lead;
  }

  async update(user: AuthUser, id: string, dto: UpdateLeadDto) {
    const before = await this.assertAccess(user, id);
    const contact = evaluateContacts({
      wechatId: dto.wechatId ?? before.wechatId,
      whatsappRaw: dto.whatsapp ?? before.whatsappRaw,
      phoneRaw: dto.phone ?? before.phoneRaw,
      email: dto.email ?? before.email,
    });
    const preservedQualityFlags = new Set<LeadQualityFlag>([
      LeadQualityFlag.SUSPECTED_SPAM,
      LeadQualityFlag.POSSIBLE_DUPLICATE,
      LeadQualityFlag.CONFIRMED_INVALID,
    ]);
    const qualityFlag = preservedQualityFlags.has(before.qualityFlag) ? before.qualityFlag : contact.qualityFlag;
    const requiresReview = preservedQualityFlags.has(before.qualityFlag)
      ? before.requiresReview || contact.requiresReview
      : contact.requiresReview;
    const after = await this.prisma.lead.update({
      where: { id },
      data: {
        name: dto.name?.trim(), countryCode: dto.countryCode?.toUpperCase(), countryName: dto.countryName?.trim(), city: dto.city?.trim(),
        companyName: dto.companyName?.trim(), jobTitle: dto.jobTitle?.trim(), wechatId: dto.wechatId?.trim(),
        whatsappRaw: dto.whatsapp?.trim(), phoneRaw: dto.phone?.trim(), email: dto.email?.trim(),
        ...contact, qualityFlag, requiresReview,
        projectType: dto.projectType, projectDescription: dto.projectDescription, purchaseTimeline: dto.purchaseTimeline,
        expectedPurchaseDate: dto.expectedPurchaseDate ? new Date(dto.expectedPurchaseDate) : undefined,
        estimatedBudget: dto.estimatedBudget, budgetCurrency: dto.budgetCurrency?.toUpperCase(), remark: dto.remark,
        assignmentState: before.assignedUserId
          ? AssignmentState.ASSIGNED
          : contact.requiresReview ? AssignmentState.REVIEW_REQUIRED : AssignmentState.UNASSIGNED,
      },
      include: leadInclude,
    });
    await this.prisma.auditLog.create({ data: { userId: user.id, action: 'UPDATE_LEAD', entityType: 'LEAD', entityId: id } });
    return after;
  }

  async changeStatus(user: AuthUser, id: string, dto: ChangeStatusDto) {
    const lead = await this.assertAccess(user, id);
    const status = await this.prisma.leadStatus.findFirst({ where: { id: dto.statusId, isActive: true } });
    if (!status) throw new BadRequestException('客户状态不存在');
    if (status.code === 'INVALID') throw new BadRequestException('标记无效时必须通过客户核查接口选择无效原因');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.lead.update({
        where: { id },
        data: { currentStatusId: status.id, wonAt: status.code === 'WON' ? now : undefined },
      }),
      this.prisma.leadStatusHistory.create({
        data: { leadId: id, fromStatusId: lead.currentStatusId, toStatusId: status.id, changedById: user.id, changeReason: dto.reason },
      }),
      this.prisma.auditLog.create({ data: { userId: user.id, action: 'CHANGE_LEAD_STATUS', entityType: 'LEAD', entityId: id } }),
    ]);
    return this.findOne(user, id);
  }

  async assign(actorId: string, leadId: string, userId: string, reason?: string) {
    const [lead, user, actor] = await Promise.all([
      this.prisma.lead.findUnique({ where: { id: leadId } }),
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.user.findUnique({ where: { id: actorId } }),
    ]);
    if (!lead) throw new NotFoundException('客户不存在');
    const isActiveSales = user?.role === UserRole.SALES && user.status === UserStatus.ACTIVE;
    const isAdminAssigningSelf = actor?.role === UserRole.ADMIN
      && actor.status === UserStatus.ACTIVE
      && user?.id === actor.id;
    if (!user || (!isActiveSales && !isAdminAssigningSelf)) {
      throw new BadRequestException('只能分配给启用中的销售或管理员本人');
    }
    await this.prisma.$transaction([
      this.prisma.lead.update({ where: { id: leadId }, data: { assignedUserId: userId, assignmentState: AssignmentState.ASSIGNED } }),
      this.prisma.leadAssignment.create({ data: { leadId, fromUserId: lead.assignedUserId, toUserId: userId, assignmentMethod: AssignmentMethod.MANUAL, assignmentReason: reason, assignedById: actorId } }),
      this.prisma.auditLog.create({ data: { userId: actorId, action: 'ASSIGN_LEAD', entityType: 'LEAD', entityId: leadId } }),
    ]);
    return this.prisma.lead.findUnique({ where: { id: leadId }, include: leadInclude });
  }

  async review(user: AuthUser, id: string, dto: ReviewLeadDto) {
    const lead = await this.assertAccess(user, id);
    if (!dto.valid && !dto.invalidReasonCode) throw new BadRequestException('确认无效时必须选择原因');
    const invalidStatus = !dto.valid ? await this.prisma.leadStatus.findUnique({ where: { code: 'INVALID' } }) : null;
    const validQuality = dto.qualityFlag ?? (
      lead.contactAvailability === 'NONE' ? LeadQualityFlag.NO_CONTACT
        : lead.contactAvailability === 'PARTIAL' ? LeadQualityFlag.INCOMPLETE_CONTACT
          : LeadQualityFlag.NORMAL
    );
    const data: Prisma.LeadUpdateInput = {
      qualityFlag: dto.valid ? validQuality : LeadQualityFlag.CONFIRMED_INVALID,
      requiresReview: false, invalidReasonCode: dto.valid ? null : dto.invalidReasonCode,
      invalidReasonNote: dto.note, reviewedBy: { connect: { id: user.id } }, reviewedAt: new Date(),
      assignmentState: lead.assignedUserId ? AssignmentState.ASSIGNED : AssignmentState.UNASSIGNED,
      ...(invalidStatus ? { currentStatus: { connect: { id: invalidStatus.id } } } : {}),
    };
    await this.prisma.lead.update({ where: { id }, data });
    if (invalidStatus && lead.currentStatusId !== invalidStatus.id) {
      await this.prisma.leadStatusHistory.create({ data: { leadId: id, fromStatusId: lead.currentStatusId, toStatusId: invalidStatus.id, changedById: user.id, changeReason: dto.note } });
    }
    return this.findOne(user, id);
  }

  async assertAccess(user: AuthUser, id: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id, archivedAt: null, ...(user.role === UserRole.SALES ? { assignedUserId: user.id } : {}) } });
    if (!lead) throw new ForbiddenException('客户不存在或无权操作');
    return lead;
  }

  private async findPossibleDuplicate(contact: ReturnType<typeof evaluateContacts>, wechatId?: string) {
    if (!contact.phoneNormalized && !contact.whatsappNormalized && !contact.emailNormalized && !wechatId) return null;
    return this.prisma.lead.findFirst({ where: { archivedAt: null, OR: [
      ...(contact.phoneNormalized ? [{ phoneNormalized: contact.phoneNormalized }] : []),
      ...(contact.whatsappNormalized ? [{ whatsappNormalized: contact.whatsappNormalized }] : []),
      ...(contact.emailNormalized ? [{ emailNormalized: contact.emailNormalized }] : []),
      ...(wechatId ? [{ wechatId: wechatId.trim() }] : []),
    ] } });
  }

  private generateLeadNumber() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `ZS-${date}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

}
