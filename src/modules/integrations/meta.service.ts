import { BadGatewayException, BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AssignmentState, IntegrationProvider, IntegrationStatus, LeadQualityFlag, LeadSource,
  Prisma, ProjectType, PurchaseTimeline,
} from '@prisma/client';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { evaluateContacts } from '../../common/utils/contact.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignmentService } from '../leads/assignment.service';
import { MetaLeadDto } from './dto/meta-lead.dto';

interface MetaFieldData { name: string; values?: string[] }
interface MetaGraphLead {
  id: string; created_time?: string; campaign_id?: string; campaign_name?: string;
  adset_id?: string; adset_name?: string; ad_id?: string; ad_name?: string;
  form_id?: string; form_name?: string; field_data?: MetaFieldData[];
}

@Injectable()
export class MetaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly assignment: AssignmentService,
  ) {}

  verifyChallenge(mode: string, token: string) {
    return mode === 'subscribe' && Boolean(token) && token === this.config.get<string>('META_VERIFY_TOKEN');
  }

  async receiveWebhook(payload: Record<string, unknown>, rawBody?: Buffer, signature?: string) {
    if (!this.verifySignature(rawBody, signature)) throw new ForbiddenException('Meta Webhook 签名无效');
    const changes = this.extractLeadgenChanges(payload);
    const eventIds: string[] = [];
    for (const change of changes) {
      const event = await this.prisma.integrationEvent.create({
        data: {
          provider: IntegrationProvider.META,
          eventType: 'leadgen',
          externalEventId: change.eventId,
          externalLeadId: change.leadgenId,
          rawPayload: payload as Prisma.InputJsonValue,
          signatureValid: true,
        },
      });
      eventIds.push(event.id);
      try {
        const graphLead = await this.fetchLead(change.leadgenId);
        await this.ingest(this.mapGraphLead(graphLead), event.id);
        await this.prisma.integrationEvent.update({ where: { id: event.id }, data: { processingStatus: IntegrationStatus.SUCCEEDED, processedAt: new Date() } });
      } catch (error) {
        await this.prisma.integrationEvent.update({
          where: { id: event.id },
          data: { processingStatus: IntegrationStatus.FAILED, errorMessage: this.errorMessage(error), processedAt: new Date() },
        });
      }
    }
    return { received: true, events: eventIds.length };
  }

  async ingest(dto: MetaLeadDto, rawEventId?: string) {
    const existingAttribution = await this.prisma.leadAttribution.findUnique({
      where: { platform_externalLeadId: { platform: LeadSource.META, externalLeadId: dto.externalLeadId } },
      include: { lead: true },
    });
    if (existingAttribution) return { created: false, lead: existingAttribution.lead };

    const contact = evaluateContacts({ wechatId: dto.wechatId, whatsappRaw: dto.whatsapp, phoneRaw: dto.phone, email: dto.email });
    const existingLead = await this.findExistingContact(contact, dto.wechatId);
    if (existingLead) {
      await this.prisma.$transaction([
        this.prisma.leadAttribution.create({
          data: { ...this.attributionData(dto, rawEventId, false), leadId: existingLead.id },
        }),
        this.prisma.lead.update({ where: { id: existingLead.id }, data: { qualityFlag: LeadQualityFlag.POSSIBLE_DUPLICATE, requiresReview: true } }),
      ]);
      return { created: false, matchedExistingLead: true, leadId: existingLead.id };
    }

    const status = await this.prisma.leadStatus.findUnique({ where: { code: 'NEW' } });
    if (!status) throw new BadRequestException('客户状态初始化未完成');
    const suspectedSpam = this.isSuspectedSpam(dto);
    const lead = await this.prisma.lead.create({
      data: {
        leadNumber: this.generateLeadNumber(), name: dto.name?.trim() || null,
        countryName: dto.country?.trim(), city: dto.city?.trim(), companyName: dto.companyName?.trim(), jobTitle: dto.jobTitle?.trim(),
        wechatId: dto.wechatId?.trim(), whatsappRaw: dto.whatsapp?.trim(), phoneRaw: dto.phone?.trim(), email: dto.email?.trim(), ...contact,
        projectType: this.mapProjectType(dto.projectType), projectDescription: dto.projectDescription,
        purchaseTimeline: this.mapPurchaseTimeline(dto.purchaseTime), estimatedBudget: dto.estimatedBudget,
        budgetCurrency: dto.budgetCurrency?.toUpperCase(), remark: dto.remark,
        sourceType: LeadSource.META, currentStatusId: status.id,
        assignmentState: contact.requiresReview || suspectedSpam ? AssignmentState.REVIEW_REQUIRED : AssignmentState.UNASSIGNED,
        qualityFlag: suspectedSpam ? LeadQualityFlag.SUSPECTED_SPAM : contact.qualityFlag,
        requiresReview: contact.requiresReview || suspectedSpam,
        attributions: { create: this.attributionData(dto, rawEventId, true) },
      },
    });
    if (!lead.requiresReview) await this.assignment.autoAssign(lead.id);
    return { created: true, leadId: lead.id };
  }

  async retry(id: string) {
    const event = await this.prisma.integrationEvent.findUnique({ where: { id } });
    if (!event || event.provider !== IntegrationProvider.META) throw new NotFoundException('Meta 接收事件不存在');
    if (!event.externalLeadId) throw new BadRequestException('事件缺少 Meta Lead ID');
    await this.prisma.integrationEvent.update({ where: { id }, data: { processingStatus: IntegrationStatus.PROCESSING, retryCount: { increment: 1 }, errorMessage: null } });
    try {
      const graphLead = await this.fetchLead(event.externalLeadId);
      const result = await this.ingest(this.mapGraphLead(graphLead), event.id);
      await this.prisma.integrationEvent.update({ where: { id }, data: { processingStatus: IntegrationStatus.SUCCEEDED, processedAt: new Date() } });
      return result;
    } catch (error) {
      await this.prisma.integrationEvent.update({ where: { id }, data: { processingStatus: IntegrationStatus.FAILED, errorMessage: this.errorMessage(error), processedAt: new Date() } });
      throw error;
    }
  }

  private async fetchLead(leadgenId: string): Promise<MetaGraphLead> {
    const token = this.config.get<string>('META_PAGE_ACCESS_TOKEN');
    if (!token) throw new BadGatewayException('未配置 Meta Page Access Token，事件已保存等待重试');
    const base = this.config.get<string>('META_GRAPH_BASE_URL', 'https://graph.facebook.com');
    const version = this.config.get<string>('META_GRAPH_API_VERSION', 'v25.0');
    const fields = 'id,created_time,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,form_id,form_name,field_data';
    const response = await fetch(`${base}/${version}/${encodeURIComponent(leadgenId)}?fields=${encodeURIComponent(fields)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json() as MetaGraphLead & { error?: { message?: string } };
    if (!response.ok) throw new BadGatewayException(body.error?.message ?? 'Meta Graph API 请求失败');
    return body;
  }

  private mapGraphLead(lead: MetaGraphLead): MetaLeadDto {
    const fields = Object.fromEntries((lead.field_data ?? []).map((item) => [item.name.toLowerCase(), item.values?.[0] ?? '']));
    return {
      externalLeadId: lead.id, campaignId: lead.campaign_id, campaignName: lead.campaign_name,
      adsetId: lead.adset_id, adsetName: lead.adset_name, adId: lead.ad_id, adName: lead.ad_name,
      formId: lead.form_id, formName: lead.form_name, createdTime: lead.created_time,
      name: fields.full_name || [fields.first_name, fields.last_name].filter(Boolean).join(' ') || undefined,
      country: fields.country || fields.country_name, city: fields.city,
      companyName: fields.company_name || fields.company, jobTitle: fields.job_title,
      wechatId: fields.wechat || fields.wechat_id, whatsapp: fields.whatsapp || fields.whatsapp_number,
      phone: fields.phone_number || fields.phone, email: fields.email,
      projectType: fields.project_type, projectDescription: fields.project_description || fields.project_details,
      purchaseTime: fields.purchase_time || fields.purchase_timeline,
      estimatedBudget: this.numberValue(fields.estimated_budget || fields.budget),
      budgetCurrency: fields.budget_currency, remark: fields.notes || fields.remark,
      rawPayload: lead as unknown as Record<string, unknown>,
    };
  }

  private attributionData(
    dto: MetaLeadDto,
    rawEventId?: string,
    isPrimary = false,
  ): Prisma.LeadAttributionUncheckedCreateWithoutLeadInput {
    return {
      platform: LeadSource.META, isPrimary, externalLeadId: dto.externalLeadId,
      campaignId: dto.campaignId, campaignName: dto.campaignName, adsetId: dto.adsetId, adsetName: dto.adsetName,
      adId: dto.adId, adName: dto.adName, formId: dto.formId, formName: dto.formName,
      externalCreatedAt: dto.createdTime ? new Date(dto.createdTime) : undefined, rawEventId,
    };
  }

  private extractLeadgenChanges(payload: Record<string, unknown>) {
    const result: Array<{ leadgenId: string; eventId?: string }> = [];
    const entries = Array.isArray(payload.entry) ? payload.entry as Array<Record<string, unknown>> : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes as Array<Record<string, unknown>> : [];
      for (const change of changes) {
        if (change.field !== 'leadgen' || typeof change.value !== 'object' || !change.value) continue;
        const value = change.value as Record<string, unknown>;
        if (typeof value.leadgen_id === 'string') result.push({ leadgenId: value.leadgen_id, eventId: String(entry.id ?? '') || undefined });
      }
    }
    return result;
  }

  private verifySignature(rawBody?: Buffer, signature?: string) {
    const secret = this.config.get<string>('META_APP_SECRET');
    if (!secret || !rawBody || !signature?.startsWith('sha256=')) return false;
    const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    const left = Buffer.from(expected); const right = Buffer.from(signature);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private async findExistingContact(contact: ReturnType<typeof evaluateContacts>, wechatId?: string) {
    const or: Prisma.LeadWhereInput[] = [];
    if (contact.phoneNormalized) or.push({ phoneNormalized: contact.phoneNormalized });
    if (contact.whatsappNormalized) or.push({ whatsappNormalized: contact.whatsappNormalized });
    if (contact.emailNormalized) or.push({ emailNormalized: contact.emailNormalized });
    if (wechatId?.trim()) or.push({ wechatId: wechatId.trim() });
    return or.length ? this.prisma.lead.findFirst({ where: { archivedAt: null, OR: or } }) : null;
  }

  private isSuspectedSpam(dto: MetaLeadDto) {
    const content = [dto.name, dto.companyName, dto.projectDescription, dto.remark].filter(Boolean).join(' ').trim();
    if (!content && !dto.wechatId && !dto.whatsapp && !dto.phone && !dto.email) return true;
    return /^(test|testing|测试|asdf|qwerty|123456|.)\1{3,}$/i.test(content);
  }

  private mapProjectType(value?: string) {
    const text = value?.toLowerCase() ?? '';
    if (text.includes('warehouse') || text.includes('仓库')) return ProjectType.WAREHOUSE;
    if (text.includes('industrial') || text.includes('factory') || text.includes('厂房')) return ProjectType.INDUSTRIAL_PLANT;
    if (text.includes('steel') || text.includes('钢结构')) return ProjectType.STEEL_BUILDING;
    return value ? ProjectType.OTHER : undefined;
  }

  private mapPurchaseTimeline(value?: string) {
    const text = value?.toLowerCase() ?? '';
    if (!text) return undefined;
    if (text.includes('1 month') || text.includes('一个月')) return PurchaseTimeline.WITHIN_1_MONTH;
    if (text.includes('1-3') || text.includes('three month') || text.includes('三个月')) return PurchaseTimeline.ONE_TO_THREE_MONTHS;
    if (text.includes('3-6') || text.includes('six month') || text.includes('六个月')) return PurchaseTimeline.THREE_TO_SIX_MONTHS;
    if (text.includes('over') || text.includes('以上')) return PurchaseTimeline.OVER_SIX_MONTHS;
    return PurchaseTimeline.UNKNOWN;
  }

  private numberValue(value?: string) {
    if (!value) return undefined;
    const parsed = Number(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private generateLeadNumber() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `ZS-${date}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message.slice(0, 2000) : '未知错误';
  }
}
