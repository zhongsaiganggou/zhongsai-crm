import { CommunicationMethod, ContactAvailability, LeadQualityFlag } from '@prisma/client';
import { evaluateContacts, normalizeEmail, normalizePhone } from './contact.util';

describe('contact utilities', () => {
  it('normalizes international phone numbers', () => {
    expect(normalizePhone('+971 50 123 4567')).toBe('+971501234567');
  });

  it('does not reject leads without contact details', () => {
    expect(evaluateContacts({})).toEqual(expect.objectContaining({
      contactAvailability: ContactAvailability.NONE,
      qualityFlag: LeadQualityFlag.NO_CONTACT,
      requiresReview: true,
    }));
  });

  it('prioritizes WeChat when present', () => {
    expect(evaluateContacts({ wechatId: 'zhongsai', phoneRaw: '+86 138 0000 0000' }).preferredChannel)
      .toBe(CommunicationMethod.WECHAT);
  });

  it('normalizes email casing and whitespace', () => {
    expect(normalizeEmail(' Sales@Example.COM ')).toBe('sales@example.com');
  });
});

