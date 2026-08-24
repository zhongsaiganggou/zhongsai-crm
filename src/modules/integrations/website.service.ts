import { Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AssignmentState, CommunicationMethod, LeadQualityFlag,
  LeadSource, Prisma, ProjectType, PurchaseTimeline,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { evaluateContacts } from '../../common/utils/contact.util';
import { AssignmentService } from '../leads/assignment.service';
import { WebsiteLeadDto } from './dto/website-lead.dto';

@Injectable()
export class WebsiteService {
  private readonly logger = new Logger(WebsiteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly assignment: AssignmentService,
  ) {}

  async receiveLead(dto: WebsiteLeadDto, ip?: string) {
    const status = await this.prisma.leadStatus.findUnique({ where: { code: 'NEW' } });
    if (!status) {
      this.logger.error('客户状态初始化未完成，缺少 NEW 状态');
      throw new ServiceUnavailableException('系统初始化未完成');
    }

    const contact = evaluateContacts({
      wechatId: dto.wechat,
      whatsappRaw: dto.whatsapp,
      phoneRaw: dto.phone,
      email: dto.email,
    });

    const duplicate = await this.findPossibleDuplicate(contact, dto.wechat);
    const qualityFlag = duplicate ? LeadQualityFlag.POSSIBLE_DUPLICATE : contact.qualityFlag;

    const projectType = this.mapProjectType(dto.projectType);
    const purchaseTimeline = this.mapPurchaseTimeline(dto.purchaseTimeline);
    const preferredChannel = this.detectPreferredChannel(dto);

    const leadNumber = this.generateLeadNumber();

    try {
      const lead = await this.prisma.lead.create({
        data: {
          leadNumber,
          name: dto.name?.trim() || null,
          countryCode: this.extractCountryCode(dto.country),
          countryName: dto.country?.trim(),
          city: dto.city?.trim(),
          companyName: dto.company?.trim(),
          jobTitle: dto.jobTitle?.trim(),
          wechatId: dto.wechat?.trim(),
          whatsappRaw: dto.whatsapp?.trim(),
          phoneRaw: dto.phone?.trim(),
          email: dto.email?.trim(),
          ...contact,
          preferredChannel,
          projectType,
          projectDescription: dto.projectDescription,
          purchaseTimeline,
          estimatedBudget: dto.budget ? this.parseBudget(dto.budget) : undefined,
          budgetCurrency: 'USD',
          sourceType: LeadSource.MANUAL,
          currentStatusId: status.id,
          assignmentState: contact.requiresReview ? AssignmentState.REVIEW_REQUIRED : AssignmentState.UNASSIGNED,
          qualityFlag,
          requiresReview: contact.requiresReview || Boolean(duplicate),
          attributions: {
            create: {
              platform: LeadSource.MANUAL,
              isPrimary: true,
              campaignName: dto.utmCampaign,
              adsetName: dto.utmContent,
              adName: dto.utmTerm,
              formName: dto.sourcePage ? `Website: ${dto.sourcePage}` : 'Website Contact Form',
              externalCreatedAt: new Date(),
            },
          },
        },
        include: {
          currentStatus: true,
          assignedUser: { select: { id: true, name: true } },
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'CREATE_LEAD_FROM_WEBSITE',
          entityType: 'LEAD',
          entityId: lead.id,
          ipAddress: ip,
          afterData: { leadNumber, source: 'website', language: dto.language } as Prisma.InputJsonValue,
        },
      });

      this.logger.log(`网站线索创建成功: ${leadNumber} (${dto.name || '匿名'})`);

      if (!lead.requiresReview) {
        await this.assignment.autoAssign(lead.id).catch((error: unknown) => {
          this.logger.warn(`网站线索自动分配失败: ${this.errorMessage(error)}`);
        });
      }

      // CRM 已先持久化，再并行推送企业微信和 Google Sheets；外部通道失败不丢失线索。
      const notifications = await Promise.allSettled([
        this.notifyWeChat(lead, dto),
        this.notifyGoogleSheets(lead, dto),
      ]);
      const channels = ['企业微信', 'Google Sheets'];
      notifications.forEach((result, index) => {
        if (result.status === 'rejected') {
          this.logger.warn(`${channels[index]}通知失败: ${this.errorMessage(result.reason)}`);
        }
      });

      return { success: true, leadNumber: lead.leadNumber, leadId: lead.id };
    } catch (error) {
      this.logger.error(`网站线索创建失败: ${error instanceof Error ? error.message : String(error)}`);
      throw new InternalServerErrorException('线索保存失败，请稍后重试');
    }
  }

  private async findPossibleDuplicate(contact: ReturnType<typeof evaluateContacts>, wechatId?: string) {
    if (!contact.phoneNormalized && !contact.whatsappNormalized && !contact.emailNormalized && !wechatId) return null;
    return this.prisma.lead.findFirst({
      where: {
        archivedAt: null,
        OR: [
          ...(contact.phoneNormalized ? [{ phoneNormalized: contact.phoneNormalized }] : []),
          ...(contact.whatsappNormalized ? [{ whatsappNormalized: contact.whatsappNormalized }] : []),
          ...(contact.emailNormalized ? [{ emailNormalized: contact.emailNormalized }] : []),
          ...(wechatId ? [{ wechatId: wechatId.trim() }] : []),
        ],
      },
    });
  }

  private generateLeadNumber() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `ZS-${date}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  private mapProjectType(type?: string): ProjectType | undefined {
    if (!type) return undefined;
    const t = type.toLowerCase();
    if (t.includes('warehouse') || t.includes('仓库')) return ProjectType.WAREHOUSE;
    if (t.includes('plant') || t.includes('factory') || t.includes('workshop') || t.includes('厂房') || t.includes('车间')) return ProjectType.INDUSTRIAL_PLANT;
    if (t.includes('building') || t.includes('建筑')) return ProjectType.STEEL_BUILDING;
    return ProjectType.OTHER;
  }

  private mapPurchaseTimeline(timeline?: string): PurchaseTimeline | undefined {
    if (!timeline) return undefined;
    const t = timeline.toLowerCase();
    if (t.includes('1 month') || t.includes('一个月') || t.includes('immediate')) return PurchaseTimeline.WITHIN_1_MONTH;
    if (t.includes('3 month') || t.includes('三个月')) return PurchaseTimeline.ONE_TO_THREE_MONTHS;
    if (t.includes('6 month') || t.includes('六个月')) return PurchaseTimeline.THREE_TO_SIX_MONTHS;
    if (t.includes('over') || t.includes('超过')) return PurchaseTimeline.OVER_SIX_MONTHS;
    return PurchaseTimeline.UNKNOWN;
  }

  private detectPreferredChannel(dto: WebsiteLeadDto): CommunicationMethod | null {
    if (dto.whatsapp) return CommunicationMethod.WHATSAPP;
    if (dto.wechat) return CommunicationMethod.WECHAT;
    if (dto.phone) return CommunicationMethod.PHONE;
    if (dto.email) return CommunicationMethod.EMAIL;
    return null;
  }

  private extractCountryCode(country?: string): string | undefined {
    if (!country) return undefined;
    const map: Record<string, string> = {
      'nigeria': 'NG', '尼日利亚': 'NG',
      'saudi arabia': 'SA', '沙特': 'SA', '沙特阿拉伯': 'SA',
      'brazil': 'BR', '巴西': 'BR',
      'malaysia': 'MY', '马来西亚': 'MY',
      'kenya': 'KE', '肯尼亚': 'KE',
      'indonesia': 'ID', '印尼': 'ID', '印度尼西亚': 'ID',
      'uae': 'AE', 'dubai': 'AE', '阿联酋': 'AE', '迪拜': 'AE',
      'peru': 'PE', '秘鲁': 'PE',
      'ethiopia': 'ET', '埃塞俄比亚': 'ET',
      'south africa': 'ZA', '南非': 'ZA',
      'vietnam': 'VN', '越南': 'VN',
      'oman': 'OM', '阿曼': 'OM',
      'mexico': 'MX', '墨西哥': 'MX',
      'philippines': 'PH', '菲律宾': 'PH',
      'thailand': 'TH', '泰国': 'TH',
      'china': 'CN', '中国': 'CN',
    };
    return map[country.toLowerCase()] || undefined;
  }

  private parseBudget(budget: string): Prisma.Decimal | undefined {
    const num = parseFloat(budget.replace(/[^0-9.]/g, ''));
    if (isNaN(num) || num <= 0) return undefined;
    return new Prisma.Decimal(num);
  }

  private async notifyWeChat(lead: { leadNumber: string; name: string | null; countryName: string | null; companyName: string | null; email: string | null; whatsappRaw: string | null; wechatId: string | null; phoneRaw: string | null; projectDescription: string | null }, dto: WebsiteLeadDto) {
    const webhookUrl = this.config.get<string>('WECHAT_WEBHOOK_URL');
    if (!webhookUrl) return;

    const content = [
      '🔔 新网站询盘通知',
      `编号: ${lead.leadNumber}`,
      `姓名: ${lead.name || '未填写'}`,
      `国家: ${lead.countryName || '未填写'}`,
      `公司: ${lead.companyName || '未填写'}`,
      `邮箱: ${lead.email || '未填写'}`,
      `WhatsApp: ${lead.whatsappRaw || '未填写'}`,
      `微信: ${lead.wechatId || '未填写'}`,
      `电话: ${lead.phoneRaw || '未填写'}`,
      `项目描述: ${lead.projectDescription || '未填写'}`,
      `来源页面: ${dto.sourcePage || '未知'}`,
      `语言: ${dto.language || '未知'}`,
    ].join('\n');

    const body = JSON.stringify({
      msgtype: 'text',
      text: { content },
    });

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  }

  private async notifyGoogleSheets(
    lead: {
      id: string;
      leadNumber: string;
      name: string | null;
      countryName: string | null;
      city: string | null;
      companyName: string | null;
      email: string | null;
      whatsappRaw: string | null;
      wechatId: string | null;
      phoneRaw: string | null;
      projectDescription: string | null;
      createdAt: Date;
    },
    dto: WebsiteLeadDto,
  ) {
    const webhookUrl = this.config.get<string>('GOOGLE_SHEETS_WEBHOOK_URL');
    if (!webhookUrl) return;
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'website_lead_created',
        lead: {
          id: lead.id,
          leadNumber: lead.leadNumber,
          name: lead.name,
          country: lead.countryName,
          city: lead.city,
          company: lead.companyName,
          wechat: lead.wechatId,
          whatsapp: lead.whatsappRaw,
          phone: lead.phoneRaw,
          email: lead.email,
          projectDescription: lead.projectDescription,
          createdAt: lead.createdAt.toISOString(),
        },
        attribution: {
          sourcePage: dto.sourcePage,
          utmSource: dto.utmSource,
          utmMedium: dto.utmMedium,
          utmCampaign: dto.utmCampaign,
          utmContent: dto.utmContent,
          utmTerm: dto.utmTerm,
          language: dto.language,
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
