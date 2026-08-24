import { ChannelCapability, UserRole } from '@prisma/client';
import { IsArray, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(32)
  mobile: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsArray()
  @IsEnum(ChannelCapability, { each: true })
  channelCapabilities: ChannelCapability[] = [];
}
