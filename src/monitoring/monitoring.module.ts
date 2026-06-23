import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CronGuard } from './cron.guard';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { NotificationService } from './notification.service';

@Module({
  imports: [AuthModule],
  controllers: [MonitoringController],
  providers: [MonitoringService, NotificationService, CronGuard],
  exports: [MonitoringService],
})
export class MonitoringModule {}
