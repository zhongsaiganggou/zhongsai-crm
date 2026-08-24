import { Module } from '@nestjs/common';
import { PoolReclaimService } from './pool-reclaim.service';
import { ReminderService } from './reminder.service';

@Module({
  providers: [ReminderService, PoolReclaimService],
  exports: [PoolReclaimService],
})
export class SchedulerModule {}
