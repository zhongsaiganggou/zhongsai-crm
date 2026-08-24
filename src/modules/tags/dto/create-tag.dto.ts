import { TagScope } from '@prisma/client';
import { IsEnum, IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTagDto {
  @IsString() @MaxLength(50) name: string;
  @IsOptional() @IsHexColor() color = '#64748B';
  @IsOptional() @IsEnum(TagScope) scope: TagScope = TagScope.PERSONAL;
}

