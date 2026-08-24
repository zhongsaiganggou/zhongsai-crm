import { ChannelCapability, UserRole, UserStatus } from '@prisma/client';
import { IsArray, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(32) mobile?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @IsOptional() @IsArray() @IsEnum(ChannelCapability, { each: true }) channelCapabilities?: ChannelCapability[];
  @IsOptional() @IsString() @MinLength(8) @MaxLength(128) password?: string;
}

