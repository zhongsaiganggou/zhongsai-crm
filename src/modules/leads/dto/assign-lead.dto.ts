import { IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignLeadDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

