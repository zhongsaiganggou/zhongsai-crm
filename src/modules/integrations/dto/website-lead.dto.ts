import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class WebsiteLeadDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  wechat?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  projectType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  projectDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  purchaseTimeline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  budget?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourcePage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmMedium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmContent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmTerm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  language?: string;
}
