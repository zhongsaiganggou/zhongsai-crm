import { Type } from 'class-transformer';
import { IsDateString, IsEmail, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class MetaLeadDto {
  @IsString() externalLeadId: string;
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsString() campaignName?: string;
  @IsOptional() @IsString() adsetId?: string;
  @IsOptional() @IsString() adsetName?: string;
  @IsOptional() @IsString() adId?: string;
  @IsOptional() @IsString() adName?: string;
  @IsOptional() @IsString() formId?: string;
  @IsOptional() @IsString() formName?: string;
  @IsOptional() @IsDateString() createdTime?: string;
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsString() wechatId?: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() projectType?: string;
  @IsOptional() @IsString() projectDescription?: string;
  @IsOptional() @IsString() purchaseTime?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) estimatedBudget?: number;
  @IsOptional() @IsString() budgetCurrency?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsObject() rawPayload?: Record<string, unknown>;
}

