import { InvalidReason, LeadQualityFlag } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class ReviewLeadDto {
  @IsBoolean()
  valid: boolean;

  @IsOptional()
  @IsEnum(LeadQualityFlag)
  qualityFlag?: LeadQualityFlag;

  @IsOptional()
  @IsEnum(InvalidReason)
  invalidReasonCode?: InvalidReason;

  @IsOptional()
  @IsString()
  note?: string;
}

