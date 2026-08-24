import { Body, Controller, Ip, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { WebsiteLeadDto } from './dto/website-lead.dto';
import { WebsiteService } from './website.service';

@ApiTags('网站表单集成')
@Controller('integrations/website')
export class WebsiteController {
  constructor(private readonly websiteService: WebsiteService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('lead')
  receiveLead(@Body() dto: WebsiteLeadDto, @Ip() ip: string) {
    return this.websiteService.receiveLead(dto, ip);
  }
}
