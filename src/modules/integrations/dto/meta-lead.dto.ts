import { Type } from 'class-transformer';
import { IsDateString, IsEmail, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class MetaLeadDto {
  @IsString() @MaxLength(150) externalLeadId: string;
  @IsOptional() @IsString() @MaxLength(150) campaignId?: string;
  @IsOptional() @IsString() @MaxLength(255) campaignName?: string;
  @IsOptional() @IsString() @MaxLength(150) adsetId?: string;
  @IsOptional() @IsString() @MaxLength(255) adsetName?: string;
  @IsOptional() @IsString() @MaxLength(150) adId?: string;
  @IsOptional() @IsString() @MaxLength(255) adName?: string;
  @IsOptional() @IsString() @MaxLength(150) formId?: string;
  @IsOptional() @IsString() @MaxLength(255) formName?: string;
  @IsOptional() @IsDateString() createdTime?: string;
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(200) companyName?: string;
  @IsOptional() @IsString() @MaxLength(150) jobTitle?: string;
  @IsOptional() @IsString() @MaxLength(100) wechatId?: string;
  @IsOptional() @IsString() @MaxLength(100) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(100) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() projectType?: string;
  @IsOptional() @IsString() @MaxLength(10000) projectDescription?: string;
  @IsOptional() @IsString() purchaseTime?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) estimatedBudget?: number;
  @IsOptional() @IsString() budgetCurrency?: string;
  @IsOptional() @IsString() @MaxLength(10000) remark?: string;
  @IsOptional() @IsObject() rawPayload?: Record<string, unknown>;
}
