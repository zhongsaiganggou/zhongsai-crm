import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser } from '../types/auth-user.type';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: AuthUser }>();
    const value = request.headers.authorization;
    if (!value?.startsWith('Bearer ')) throw new UnauthorizedException('请先登录');

    try {
      const payload = await this.jwtService.verifyAsync<AuthUser>(value.slice(7));
      const user = await this.prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, role: true, mobile: true, status: true },
      });
      if (!user || user.status !== UserStatus.ACTIVE) throw new Error('disabled');
      request.user = { id: user.id, role: user.role, mobile: user.mobile };
      return true;
    } catch {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }
  }
}

