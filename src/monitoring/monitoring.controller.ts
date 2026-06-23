import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CronGuard } from './cron.guard';
import { MonitoringService } from './monitoring.service';

/**
 * Cron-styrd dokumentövervakning. Vercel Cron pingar `GET /cron/reminders`
 * dagligen (se vercel.json). POST finns för manuell körning med samma skydd.
 */
@UseGuards(CronGuard)
@Controller('cron')
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Get('reminders')
  runViaCron() {
    return this.monitoring.runReminderSweep();
  }

  @Post('reminders')
  runManually() {
    return this.monitoring.runReminderSweep();
  }
}
