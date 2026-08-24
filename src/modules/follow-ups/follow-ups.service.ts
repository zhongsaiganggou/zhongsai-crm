import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/types/auth-user.type';
import { LeadsService } from '../leads/leads.service';
import { CreateFollowUpDto } from './dto/create-follow-up.dto';

@Injectable()
export class FollowUpsService {
  constructor(private readonly prisma: PrismaService, private readonly leads: LeadsService) {}

  async create(user: AuthUser, leadId: string, dto: CreateFollowUpDto) {
    const lead = await this.leads.assertAccess(user, leadId);
    const followedUpAt = dto.followedUpAt ? new Date(dto.followedUpAt) : new Date();
    const nextFollowUpAt = dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : null;
    if (nextFollowUpAt && nextFollowUpAt <= followedUpAt) throw new BadRequestException('下次跟进时间必须晚于本次跟进时间');
    if (dto.statusId) {
      const status = await this.prisma.leadStatus.findFirst({ where: { id: dto.statusId, isActive: true } });
      if (!status) throw new BadRequestException('客户状态不存在');
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const followUp = await tx.followUpRecord.create({
        data: { leadId, userId: user.id, followedUpAt, communicationMethod: dto.communicationMethod, content: dto.content.trim(), nextFollowUpAt },
        include: { user: { select: { id: true, name: true } } },
      });
      await tx.lead.update({
        where: { id: leadId },
        data: {
          lastFollowedUpAt: followedUpAt,
          firstContactedAt: lead.firstContactedAt ?? followedUpAt,
          nextFollowUpAt,
          ...(dto.statusId ? { currentStatusId: dto.statusId } : {}),
        },
      });
      if (dto.statusId && dto.statusId !== lead.currentStatusId) {
        await tx.leadStatusHistory.create({ data: { leadId, fromStatusId: lead.currentStatusId, toStatusId: dto.statusId, changedById: user.id, changeReason: '添加跟进时修改状态' } });
      }
      await tx.auditLog.create({ data: { userId: user.id, action: 'CREATE_FOLLOW_UP', entityType: 'LEAD', entityId: leadId } });
      return followUp;
    });
    return result;
  }
}

