import { CommunicationMethod, ContactAvailability, LeadQualityFlag } from '@prisma/client';

export function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

export function normalizePhone(value?: string | null) {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return `${trimmed.startsWith('+') ? '+' : ''}${digits}`;
}

export function evaluateContacts(input: {
  wechatId?: string | null;
  whatsappRaw?: string | null;
  phoneRaw?: string | null;
  email?: string | null;
}) {
  const whatsappNormalized = normalizePhone(input.whatsappRaw);
  const phoneNormalized = normalizePhone(input.phoneRaw);
  const emailNormalized = normalizeEmail(input.email);
  const hasAnyRaw = Boolean(input.wechatId?.trim() || input.whatsappRaw?.trim() || input.phoneRaw?.trim() || input.email?.trim());
  const hasValid = Boolean(input.wechatId?.trim() || whatsappNormalized || phoneNormalized || emailNormalized);

  let preferredChannel: CommunicationMethod | null = null;
  if (input.wechatId?.trim()) preferredChannel = CommunicationMethod.WECHAT;
  else if (whatsappNormalized) preferredChannel = CommunicationMethod.WHATSAPP;
  else if (phoneNormalized) preferredChannel = CommunicationMethod.PHONE;
  else if (emailNormalized) preferredChannel = CommunicationMethod.EMAIL;

  return {
    whatsappNormalized,
    phoneNormalized,
    emailNormalized,
    preferredChannel,
    contactAvailability: hasValid
      ? ContactAvailability.AVAILABLE
      : hasAnyRaw
        ? ContactAvailability.PARTIAL
        : ContactAvailability.NONE,
    qualityFlag: hasValid
      ? LeadQualityFlag.NORMAL
      : hasAnyRaw
        ? LeadQualityFlag.INCOMPLETE_CONTACT
        : LeadQualityFlag.NO_CONTACT,
    requiresReview: !hasValid,
  };
}

