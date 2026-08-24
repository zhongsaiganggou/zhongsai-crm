import { CommunicationMethod } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateFollowUpDto {
  @IsOptional() @IsDateString() followedUpAt?: string;
  @IsEnum(CommunicationMethod) communicationMethod: CommunicationMethod;
  @IsString() @MinLength(1) content: string;
  @IsOptional() @IsDateString() nextFollowUpAt?: string;
  @IsOptional() @IsUUID() statusId?: string;
}

