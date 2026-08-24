import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const statuses = [
  { code: 'NEW', nameZh: '新线索', color: '#2563EB', sortOrder: 1, isTerminal: false },
  { code: 'CONTACTED', nameZh: '已联系', color: '#0891B2', sortOrder: 2, isTerminal: false },
  { code: 'COMMUNICATING', nameZh: '沟通中', color: '#7C3AED', sortOrder: 3, isTerminal: false },
  { code: 'REQUIREMENT_CONFIRMED', nameZh: '需求确认', color: '#4F46E5', sortOrder: 4, isTerminal: false },
  { code: 'QUOTING', nameZh: '报价中', color: '#D97706', sortOrder: 5, isTerminal: false },
  { code: 'FOLLOWING_UP', nameZh: '跟进中', color: '#EA580C', sortOrder: 6, isTerminal: false },
  { code: 'WON', nameZh: '成交', color: '#16A34A', sortOrder: 7, isTerminal: true },
  { code: 'LOST', nameZh: '失败', color: '#DC2626', sortOrder: 8, isTerminal: true },
  { code: 'INVALID', nameZh: '无效', color: '#64748B', sortOrder: 9, isTerminal: true },
];

async function main() {
  for (const status of statuses) {
    await prisma.leadStatus.upsert({ where: { code: status.code }, create: status, update: status });
  }

  const mobile = process.env.SEED_ADMIN_MOBILE ?? '13800000000';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  await prisma.user.upsert({
    where: { mobile },
    create: {
      name: '系统管理员', mobile, passwordHash: await bcrypt.hash(password, 12), role: UserRole.ADMIN,
    },
    update: {},
  });
  console.log(`初始化完成，管理员手机号：${mobile}。首次登录后请立即修改密码。`);
}

main().finally(async () => prisma.$disconnect());

