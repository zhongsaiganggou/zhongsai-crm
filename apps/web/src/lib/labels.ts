import type { CommunicationMethod, LeadQualityFlag, LeadSource } from '../types';

export const sourceLabels: Record<LeadSource, string> = {
  META: 'Meta广告',
  TIKTOK: 'TikTok广告',
  MANUAL: '手动添加',
};

export const qualityLabels: Record<LeadQualityFlag, string> = {
  NORMAL: '正常',
  NO_CONTACT: '无联系方式',
  INCOMPLETE_CONTACT: '联系方式不完整',
  SUSPECTED_SPAM: '疑似垃圾',
  POSSIBLE_DUPLICATE: '疑似重复',
  CONFIRMED_INVALID: '已确认无效',
};

export const communicationLabels: Record<CommunicationMethod, string> = {
  WECHAT: '微信',
  WHATSAPP: 'WhatsApp',
  PHONE: '电话',
  EMAIL: '邮箱',
  REVIEW: '核查记录',
};

export const projectTypeLabels: Record<string, string> = {
  INDUSTRIAL_PLANT: '工业厂房',
  WAREHOUSE: '仓库',
  STEEL_BUILDING: '钢结构建筑',
  OTHER: '其他',
};

export const purchaseTimelineLabels: Record<string, string> = {
  WITHIN_1_MONTH: '1个月内',
  ONE_TO_THREE_MONTHS: '1至3个月',
  THREE_TO_SIX_MONTHS: '3至6个月',
  OVER_SIX_MONTHS: '6个月以上',
  UNKNOWN: '暂不确定',
};

export const invalidReasonLabels: Record<string, string> = {
  SPAM: '垃圾表单',
  FAKE_INFORMATION: '虚假信息',
  NO_CONTACT_INFORMATION: '无联系方式',
  INVALID_CONTACT_INFORMATION: '联系方式无效',
  DUPLICATE: '重复线索',
  WRONG_INDUSTRY: '非目标行业',
  NO_PURCHASE_INTENT: '无采购意向',
  TEST_SUBMISSION: '测试提交',
  OTHER: '其他',
};

export function formatDate(value?: string | null, withTime = true) {
  if (!value) return '未提供';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未提供';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(date);
}

export function display(value?: string | number | null) {
  return value === null || value === undefined || value === '' ? '未提供' : String(value);
}

