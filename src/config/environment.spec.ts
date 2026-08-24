import { validateEnvironment } from './environment';

const validEnvironment = {
  NODE_ENV: 'production',
  PORT: '3000',
  DATABASE_URL: 'postgresql://user:password@postgres:5432/crm',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  CORS_ORIGINS: 'https://crm.example.com',
};

describe('validateEnvironment', () => {
  it('accepts a complete production environment', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      PORT: 3000,
      CORS_ORIGINS: 'https://crm.example.com',
    });
  });

  it('rejects short JWT secrets', () => {
    expect(() => validateEnvironment({ ...validEnvironment, JWT_ACCESS_SECRET: 'short' }))
      .toThrow('不得少于 32 个字符');
  });

  it('rejects non-HTTPS production CORS origins', () => {
    expect(() => validateEnvironment({ ...validEnvironment, CORS_ORIGINS: 'http://crm.example.com' }))
      .toThrow('必须使用 HTTPS');
  });
});
