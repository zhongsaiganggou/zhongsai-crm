import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/types/auth-user.type';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto, ip?: string) {
    const account = dto.account.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ mobile: dto.account.trim() }, { email: account }] },
    });
    if (!user || user.status !== UserStatus.ACTIVE || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('账号或密码错误');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: 'LOGIN', entityType: 'USER', entityId: user.id, ipAddress: ip },
    });
    return this.issueTokens({ id: user.id, role: user.role, mobile: user.mobile }, dto.deviceInfo);
  }

  async refresh(token: string) {
    const payload = await this.verifyRefreshToken(token);
    const stored = await this.prisma.refreshToken.findUnique({ where: { id: payload.tokenId }, include: { user: true } });
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date() || stored.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('刷新凭证已失效');
    }
    if (this.hashToken(token) !== stored.tokenHash) throw new UnauthorizedException('刷新凭证无效');
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(
      { id: stored.user.id, role: stored.user.role, mobile: stored.user.mobile },
      stored.deviceInfo ?? 'unknown',
    );
  }

  async logout(userId: string, token: string) {
    try {
      const payload = await this.verifyRefreshToken(token);
      await this.prisma.refreshToken.updateMany({
        where: { id: payload.tokenId, userId },
        data: { revokedAt: new Date() },
      });
    } catch {
      // 退出登录保持幂等，不向客户端暴露 Token 是否存在。
    }
    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('当前密码错误');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.auditLog.create({ data: { userId, action: 'CHANGE_PASSWORD', entityType: 'USER', entityId: userId } }),
    ]);
    return { success: true };
  }

  private async issueTokens(user: AuthUser, deviceInfo: string) {
    const accessToken = await this.jwt.signAsync(user);
    const tokenId = randomUUID();
    const days = this.config.get<number>('JWT_REFRESH_TTL_DAYS', 30);
    const expiresAt = new Date(Date.now() + days * 86_400_000);
    const refreshToken = await this.jwt.signAsync(
      { id: user.id, tokenId, type: 'refresh' },
      { secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'), expiresIn: `${days}d` },
    );
    await this.prisma.refreshToken.create({
      data: { id: tokenId, userId: user.id, tokenHash: this.hashToken(refreshToken), deviceInfo, expiresAt },
    });
    return { accessToken, refreshToken, expiresIn: this.config.get('JWT_ACCESS_TTL', '15m'), user };
  }

  private async verifyRefreshToken(token: string) {
    try {
      const payload = await this.jwt.verifyAsync<{ id: string; tokenId: string; type: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      if (payload.type !== 'refresh') throw new Error('type');
      return payload;
    } catch {
      throw new UnauthorizedException('刷新凭证无效');
    }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
