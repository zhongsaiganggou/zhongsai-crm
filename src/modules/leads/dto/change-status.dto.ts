import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ChangeStatusDto {
  @IsUUID()
  statusId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

