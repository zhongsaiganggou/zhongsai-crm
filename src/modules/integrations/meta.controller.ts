import { Body, Controller, ForbiddenException, Get, Headers, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MetaLeadDto } from './dto/meta-lead.dto';
import { MetaService } from './meta.service';

@ApiTags('Meta Lead Ads')
@Controller('integrations/meta')
export class MetaController {
  constructor(private readonly metaService: MetaService) {}

  @Public()
  @Get('webhook')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    if (!this.metaService.verifyChallenge(mode, token)) throw new ForbiddenException('Webhook 验证失败');
    return challenge;
  }

  @Public()
  @Post('webhook')
  webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.metaService.receiveWebhook(payload, req.rawBody, signature);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('import')
  importLead(@Body() dto: MetaLeadDto) {
    return this.metaService.ingest(dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('events/:id/retry')
  retry(@Param('id') id: string) {
    return this.metaService.retry(id);
  }
}

