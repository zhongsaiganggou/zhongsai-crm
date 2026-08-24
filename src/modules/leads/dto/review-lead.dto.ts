import { InvalidReason, LeadQualityFlag } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

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
  @MaxLength(5000)
  note?: string;
}
