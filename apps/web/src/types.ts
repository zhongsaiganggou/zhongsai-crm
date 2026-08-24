export type UserRole = 'ADMIN' | 'SALES';
export type UserStatus = 'ACTIVE' | 'DISABLED';
export type LeadSource = 'META' | 'TIKTOK' | 'MANUAL';
export type LeadQualityFlag =
  | 'NORMAL'
  | 'NO_CONTACT'
  | 'INCOMPLETE_CONTACT'
  | 'SUSPECTED_SPAM'
  | 'POSSIBLE_DUPLICATE'
  | 'CONFIRMED_INVALID';
export type AssignmentState = 'UNASSIGNED' | 'ASSIGNED' | 'REVIEW_REQUIRED';
export type CommunicationMethod = 'WECHAT' | 'WHATSAPP' | 'PHONE' | 'EMAIL' | 'REVIEW';
export type TagScope = 'PERSONAL' | 'SHARED';

export interface User {
  id: string;
  name: string;
  mobile: string;
  email?: string | null;
  role: UserRole;
  status?: UserStatus;
  channelCapabilities?: string[];
  lastLoginAt?: string | null;
  createdAt?: string;
  _count?: { assignedLeads: number };
}

export interface LeadStatus {
  id: string;
  code: string;
  nameZh: string;
  color: string;
  sortOrder: number;
  isTerminal: boolean;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  scope: TagScope;
  createdById: string;
  _count?: { leads: number };
}

export interface LeadAttribution {
  id: string;
  platform: LeadSource;
  isPrimary: boolean;
  externalLeadId?: string | null;
  campaignName?: string | null;
  adsetName?: string | null;
  adName?: string | null;
  formName?: string | null;
  externalCreatedAt?: string | null;
  receivedAt: string;
}

export interface FollowUp {
  id: string;
  followedUpAt: string;
  communicationMethod: CommunicationMethod;
  content: string;
  nextFollowUpAt?: string | null;
  user: Pick<User, 'id' | 'name'>;
}

export interface Lead {
  id: string;
  leadNumber: string;
  name?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  city?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  wechatId?: string | null;
  whatsappRaw?: string | null;
  whatsappNormalized?: string | null;
  phoneRaw?: string | null;
  phoneNormalized?: string | null;
  email?: string | null;
  preferredChannel?: CommunicationMethod | null;
  contactAvailability: 'AVAILABLE' | 'PARTIAL' | 'NONE' | 'INVALID';
  projectType?: string | null;
  projectDescription?: string | null;
  purchaseTimeline?: string | null;
  expectedPurchaseDate?: string | null;
  estimatedBudget?: string | number | null;
  budgetCurrency?: string | null;
  remark?: string | null;
  sourceType: LeadSource;
  currentStatusId: string;
  currentStatus: LeadStatus;
  assignedUserId?: string | null;
  assignedUser?: Pick<User, 'id' | 'name' | 'mobile'> | null;
  assignmentState: AssignmentState;
  qualityFlag: LeadQualityFlag;
  requiresReview: boolean;
  invalidReasonCode?: string | null;
  invalidReasonNote?: string | null;
  firstContactedAt?: string | null;
  lastFollowedUpAt?: string | null;
  nextFollowUpAt?: string | null;
  createdAt: string;
  updatedAt: string;
  attributions: LeadAttribution[];
  tags: Array<{ id: string; tag: Tag }>;
  followUps?: FollowUp[];
  statusHistory?: Array<{
    id: string;
    createdAt: string;
    fromStatus?: LeadStatus | null;
    toStatus: LeadStatus;
    changedBy: Pick<User, 'id' | 'name'>;
    changeReason?: string | null;
  }>;
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface Overview {
  total: number;
  today: number;
  due: number;
  overdueThreeDays: number;
  valid: number;
  bySource: Array<{ sourceType: LeadSource; _count: number }>;
  byQuality: Array<{ qualityFlag: LeadQualityFlag; _count: number }>;
  byStatus: Array<{ id: string; code: string; nameZh: string; count: number }>;
}

export interface AdsAnalytics {
  campaigns: Array<{ platform: LeadSource; campaignId?: string | null; campaignName?: string | null; _count: number }>;
  ads: Array<{ platform: LeadSource; adId?: string | null; adName?: string | null; _count: number }>;
  forms: Array<{ platform: LeadSource; formId?: string | null; formName?: string | null; _count: number }>;
  countries: Array<{ countryCode?: string | null; countryName?: string | null; _count: number }>;
}

