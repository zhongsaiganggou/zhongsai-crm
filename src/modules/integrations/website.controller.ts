import { Body, Controller, Ip, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { WebsiteLeadDto } from './dto/website-lead.dto';
import { WebsiteService } from './website.service';

@ApiTags('网站表单集成')
@Controller('integrations/website')
export class WebsiteController {
  constructor(private readonly websiteService: WebsiteService) {}

  @Public()
  @Post('lead')
  receiveLead(@Body() dto: WebsiteLeadDto, @Ip() ip: string) {
    return this.websiteService.receiveLead(dto, ip);
  }
}
