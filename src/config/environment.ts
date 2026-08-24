const REQUIRED_KEYS = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'CORS_ORIGINS',
] as const;

export function validateEnvironment(values: Record<string, unknown>) {
  for (const key of REQUIRED_KEYS) {
    if (typeof values[key] !== 'string' || !String(values[key]).trim()) {
      throw new Error(`缺少必需环境变量: ${key}`);
    }
  }

  const port = Number(values.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT 必须是 1 到 65535 之间的整数');
  }

  const accessSecret = String(values.JWT_ACCESS_SECRET);
  const refreshSecret = String(values.JWT_REFRESH_SECRET);
  if (accessSecret.length < 32 || refreshSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET 和 JWT_REFRESH_SECRET 均不得少于 32 个字符');
  }
  if (accessSecret === refreshSecret) {
    throw new Error('JWT Access 与 Refresh 必须使用不同密钥');
  }

  const databaseUrl = String(values.DATABASE_URL);
  if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    throw new Error('DATABASE_URL 必须是 PostgreSQL 连接地址');
  }

  const production = values.NODE_ENV === 'production';
  const origins = String(values.CORS_ORIGINS).split(',').map((value) => value.trim()).filter(Boolean);
  if (!origins.length) throw new Error('CORS_ORIGINS 至少需要一个来源');
  for (const origin of origins) {
    const url = new URL(origin);
    if (production && url.protocol !== 'https:') {
      throw new Error(`生产环境 CORS 来源必须使用 HTTPS: ${origin}`);
    }
  }

  return { ...values, PORT: port, CORS_ORIGINS: origins.join(',') };
}
