import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TagScope, UserRole } from '@prisma/client';
import { AuthUser } from '../../common/types/auth-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { LeadsService } from '../leads/leads.service';
import { CreateTagDto } from './dto/create-tag.dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService, private readonly leads: LeadsService) {}

  findAll(user: AuthUser) {
    return this.prisma.tag.findMany({
      where: { isActive: true, OR: [{ scope: TagScope.SHARED }, { createdById: user.id }] },
      include: { _count: { select: { leads: true } } },
      orderBy: [{ scope: 'desc' }, { name: 'asc' }],
    });
  }

  async create(user: AuthUser, dto: CreateTagDto) {
    if (dto.scope === TagScope.SHARED && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('只有管理员可以创建共享标签');
    }
    try {
      return await this.prisma.tag.create({ data: { name: dto.name.trim(), color: dto.color, scope: dto.scope, createdById: user.id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('标签名称已存在');
      }
      throw error;
    }
  }

  async remove(user: AuthUser, id: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('标签不存在');
    if (tag.createdById !== user.id && user.role !== UserRole.ADMIN) throw new ForbiddenException('不能删除他人的标签');
    await this.prisma.tag.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }

  async addToLead(user: AuthUser, tagId: string, leadId: string) {
    await this.leads.assertAccess(user, leadId);
    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, isActive: true, OR: [{ scope: TagScope.SHARED }, { createdById: user.id }] },
    });
    if (!tag) throw new ForbiddenException('标签不存在或不可用');
    return this.prisma.leadTag.upsert({
      where: { leadId_tagId: { leadId, tagId } },
      create: { leadId, tagId, taggedById: user.id },
      update: {},
      include: { tag: true },
    });
  }

  async removeFromLead(user: AuthUser, tagId: string, leadId: string) {
    await this.leads.assertAccess(user, leadId);
    await this.prisma.leadTag.deleteMany({ where: { leadId, tagId } });
    return { success: true };
  }
}

