import { AssignmentState, LeadQualityFlag, LeadSource } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/utils/pagination.dto';

export class QueryLeadsDto extends PaginationDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsUUID() statusId?: string;
  @IsOptional() @IsEnum(LeadSource) sourceType?: LeadSource;
  @IsOptional() @IsEnum(LeadQualityFlag) qualityFlag?: LeadQualityFlag;
  @IsOptional() @IsEnum(AssignmentState) assignmentState?: AssignmentState;
  @IsOptional() @IsUUID() assignedUserId?: string;
  @IsOptional() @IsString() countryCode?: string;
  @IsOptional() @IsUUID() tagId?: string;
  @IsOptional() @IsDateString() createdFrom?: string;
  @IsOptional() @IsDateString() createdTo?: string;
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() overdue?: boolean;
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() requiresReview?: boolean;
}

