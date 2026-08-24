import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({ imports: [LeadsModule], controllers: [TagsController], providers: [TagsService] })
export class TagsModule {}

