import { LeadSource, ProjectType, PurchaseTimeline } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Length, MaxLength, Min } from 'class-validator';

export class CreateLeadDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @Length(2, 2) countryCode?: string;
  @IsOptional() @IsString() @MaxLength(100) countryName?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(200) companyName?: string;
  @IsOptional() @IsString() @MaxLength(150) jobTitle?: string;
  @IsOptional() @IsString() @MaxLength(100) wechatId?: string;
  @IsOptional() @IsString() @MaxLength(100) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(100) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsEnum(ProjectType) projectType?: ProjectType;
  @IsOptional() @IsString() @MaxLength(10000) projectDescription?: string;
  @IsOptional() @IsEnum(PurchaseTimeline) purchaseTimeline?: PurchaseTimeline;
  @IsOptional() @IsDateString() expectedPurchaseDate?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) estimatedBudget?: number;
  @IsOptional() @IsString() @Length(3, 3) budgetCurrency?: string;
  @IsOptional() @IsString() @MaxLength(10000) remark?: string;
  @IsOptional() @IsEnum(LeadSource) sourceType: LeadSource = LeadSource.MANUAL;
  @IsOptional() @IsUUID() assignedUserId?: string;
}
