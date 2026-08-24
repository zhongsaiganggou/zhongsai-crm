import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { FollowUpsController } from './follow-ups.controller';
import { FollowUpsService } from './follow-ups.service';

@Module({ imports: [LeadsModule], controllers: [FollowUpsController], providers: [FollowUpsService] })
export class FollowUpsModule {}

