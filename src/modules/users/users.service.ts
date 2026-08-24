import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const safeUserSelect = {
  id: true, name: true, mobile: true, email: true, role: true, status: true,
  channelCapabilities: true, lastLoginAt: true, createdAt: true, updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findMe(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: safeUserSelect });
  }

  findAll() {
    return this.prisma.user.findMany({
      select: { ...safeUserSelect, _count: { select: { assignedLeads: { where: { archivedAt: null } } } } },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }

  async create(actorId: string, dto: CreateUserDto) {
    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name.trim(), mobile: dto.mobile.trim(), email: dto.email?.trim().toLowerCase(),
          passwordHash: await bcrypt.hash(dto.password, 12), role: dto.role,
          channelCapabilities: dto.channelCapabilities,
        },
        select: safeUserSelect,
      });
      await this.prisma.auditLog.create({
        data: { userId: actorId, action: 'CREATE_USER', entityType: 'USER', entityId: user.id, afterData: user },
      });
      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('手机号或邮箱已存在');
      }
      throw error;
    }
  }

  async update(actorId: string, id: string, dto: UpdateUserDto) {
    const before = await this.prisma.user.findUnique({ where: { id }, select: safeUserSelect });
    if (!before) throw new NotFoundException('账号不存在');
    if (actorId === id && dto.status === UserStatus.DISABLED) throw new BadRequestException('不能停用自己的账号');
    const data: Prisma.UserUpdateInput = {
      name: dto.name?.trim(), mobile: dto.mobile?.trim(), email: dto.email?.trim().toLowerCase(),
      role: dto.role, status: dto.status, channelCapabilities: dto.channelCapabilities,
      ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 12) } : {}),
    };
    const after = await this.prisma.user.update({ where: { id }, data, select: safeUserSelect });
    if (dto.status === UserStatus.DISABLED || dto.password) {
      await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.prisma.auditLog.create({
      data: { userId: actorId, action: 'UPDATE_USER', entityType: 'USER', entityId: id, beforeData: before, afterData: after },
    });
    return after;
  }
}
