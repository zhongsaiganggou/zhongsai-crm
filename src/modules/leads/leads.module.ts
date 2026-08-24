import { Module } from '@nestjs/common';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { AssignmentService } from './assignment.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [SchedulerModule],
  controllers: [LeadsController],
  providers: [LeadsService, AssignmentService],
  exports: [LeadsService, AssignmentService],
})
export class LeadsModule {}

