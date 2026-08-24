import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { MetaController } from './meta.controller';
import { MetaService } from './meta.service';
import { WebsiteController } from './website.controller';
import { WebsiteService } from './website.service';

@Module({ imports: [LeadsModule], controllers: [MetaController, WebsiteController], providers: [MetaService, WebsiteService] })
export class IntegrationsModule {}

