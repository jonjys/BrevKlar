import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';
import {
  buildReminderMessage,
  classifyUrgency,
  daysUntil,
  DEFAULT_REMINDER_WINDOW_DAYS,
  ReminderUrgency,
} from './reminder.logic';

export interface ReminderSweepResult {
  scanned: number;
  sent: number;
  failed: number;
  byUrgency: Record<ReminderUrgency, number>;
  ranAt: string;
}

/**
 * Dokumentövervakning. Triggas av Vercel Cron (en gång per dygn) via den
 * säkrade endpointen och skickar deadline-påminnelser. Idempotent: varje
 * deadline påminns en gång (`reminderSent`), och fältet sätts först efter att
 * notifieringen faktiskt levererats.
 */
@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async runReminderSweep(
    now: Date = new Date(),
    windowDays: number = DEFAULT_REMINDER_WINDOW_DAYS,
  ): Promise<ReminderSweepResult> {
    const horizon = new Date(now.getTime());
    horizon.setUTCDate(horizon.getUTCDate() + windowDays);
    horizon.setUTCHours(23, 59, 59, 999);

    const deadlines = await this.prisma.deadline.findMany({
      where: {
        isCompleted: false,
        reminderSent: false,
        dueDate: { lte: horizon },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        document: {
          select: {
            id: true,
            senderName: true,
            documentType: true,
            user: { select: { id: true, email: true } },
          },
        },
      },
    });

    const byUrgency: Record<ReminderUrgency, number> = {
      OVERDUE: 0,
      CRITICAL: 0,
      URGENT: 0,
      UPCOMING: 0,
    };
    let sent = 0;
    let failed = 0;

    for (const deadline of deadlines) {
      const daysLeft = daysUntil(deadline.dueDate, now);
      const urgency = classifyUrgency(daysLeft);
      const message = buildReminderMessage({
        senderName: deadline.document.senderName,
        documentType: deadline.document.documentType,
        description: deadline.description,
        dueDate: deadline.dueDate,
        daysLeft,
        urgency,
      });

      let delivered = false;
      try {
        delivered = await this.notifications.send({
          userId: deadline.document.user.id,
          email: deadline.document.user.email,
          deadlineId: deadline.id,
          documentId: deadline.document.id,
          dueDate: deadline.dueDate,
          daysLeft,
          urgency,
          message,
        });
      } catch (err) {
        this.logger.error(`Kunde inte skicka påminnelse för deadline ${deadline.id}`, err as Error);
      }

      if (delivered) {
        await this.prisma.deadline.update({
          where: { id: deadline.id },
          data: { reminderSent: true },
        });
        sent += 1;
        byUrgency[urgency] += 1;
      } else {
        failed += 1;
      }
    }

    const result: ReminderSweepResult = {
      scanned: deadlines.length,
      sent,
      failed,
      byUrgency,
      ranAt: now.toISOString(),
    };
    this.logger.log(
      `Påminnelse-svep klart: ${sent}/${deadlines.length} skickade (${failed} misslyckade).`,
    );
    return result;
  }
}
